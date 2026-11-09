"""Encrypted credential vault.

Secrets (API tokens, OAuth refresh tokens) are encrypted with Fernet
(AES-128-CBC + HMAC-SHA256) and stored in the SQLite `credentials` table.
The encryption key lives in the operating system keychain (macOS Keychain via
`keyring`); if no keychain is available it is kept in data/vault.key with
owner-only permissions. Values are never returned to the frontend: the API
only reports whether a secret is configured.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from ..db.database import Database, now_iso

KEYRING_SERVICE = "jarvis-veyro"
KEYRING_NAME = "vault-key"


def _load_key(data_dir: Path, use_keyring: bool = True) -> bytes:
    if use_keyring:
        try:
            import keyring  # type: ignore

            existing = keyring.get_password(KEYRING_SERVICE, KEYRING_NAME)
            if existing:
                return existing.encode()
            key = Fernet.generate_key()
            keyring.set_password(KEYRING_SERVICE, KEYRING_NAME, key.decode())
            if keyring.get_password(KEYRING_SERVICE, KEYRING_NAME) == key.decode():
                return key
        except Exception:  # no usable keychain (servers, CI): file fallback
            pass
    path = data_dir / "vault.key"
    if path.exists():
        return path.read_bytes().strip()
    key = Fernet.generate_key()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(key)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    return key


class Vault:
    def __init__(self, db: Database, data_dir: Path, use_keyring: bool = True):
        self.db = db
        self._fernet = Fernet(_load_key(data_dir, use_keyring))

    def set(self, name: str, value: Any) -> None:
        token = self._fernet.encrypt(json.dumps(value).encode())
        self.db.execute(
            "INSERT INTO credentials (name, ciphertext, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(name) DO UPDATE SET ciphertext = excluded.ciphertext, updated_at = excluded.updated_at",
            (name, token, now_iso()))

    def get(self, name: str, default: Any = None) -> Any:
        row = self.db.one("SELECT ciphertext FROM credentials WHERE name = ?", (name,))
        if not row:
            return default
        try:
            return json.loads(self._fernet.decrypt(row["ciphertext"]).decode())
        except (InvalidToken, ValueError):
            return default

    def has(self, name: str) -> bool:
        return self.db.one("SELECT 1 FROM credentials WHERE name = ?", (name,)) is not None

    def delete(self, name: str) -> None:
        self.db.execute("DELETE FROM credentials WHERE name = ?", (name,))

    def names(self) -> list[str]:
        return [r["name"] for r in self.db.query("SELECT name FROM credentials ORDER BY name")]


def secret(services: Any, name: str) -> Any:
    """Environment/.env value first (JARVIS_<NAME>), then the encrypted vault."""
    value = getattr(services.settings, name, None)
    if value:
        return value
    return services.vault.get(name)
