"""Local token authentication.

A random token is generated on first start and stored in
``data/auth-token`` with owner-only permissions. The UI receives it once
through the local login screen (paste) or the ``jarvis token`` command.
"""

from __future__ import annotations

import hmac
import os
import secrets
from pathlib import Path


def load_or_create_token(path: Path) -> str:
    if path.exists():
        token = path.read_text(encoding="utf-8").strip()
        if token:
            return token
    token = secrets.token_urlsafe(32)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(token, encoding="utf-8")
    try:
        os.chmod(path, 0o600)
    except OSError:  # Windows: ACLs differ; file stays in the user profile
        pass
    return token


def token_matches(expected: str, provided: str | None) -> bool:
    if not provided:
        return False
    return hmac.compare_digest(expected.encode(), provided.encode())
