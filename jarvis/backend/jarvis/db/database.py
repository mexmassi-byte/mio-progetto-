"""SQLite access layer.

A single connection guarded by a re-entrant lock. JARVIS is a single-user,
local application, so this is simpler and safer than a connection pool:
WAL mode lets the UI read while the engine writes.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from .migrations import MIGRATIONS


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def loads(value: str | None, default: Any = None) -> Any:
    if value is None or value == "":
        return default
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


class Database:
    def __init__(self, path: Path | str):
        self.path = str(path)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(self.path, check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._conn.execute("PRAGMA busy_timeout=5000")
        self._tx_depth = 0

    # ------------------------------------------------------------------ core
    def execute(self, sql: str, params: tuple | dict = ()) -> sqlite3.Cursor:
        with self._lock:
            return self._conn.execute(sql, params)

    def query(self, sql: str, params: tuple | dict = ()) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(r) for r in self._conn.execute(sql, params).fetchall()]

    def one(self, sql: str, params: tuple | dict = ()) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(sql, params).fetchone()
            return dict(row) if row else None

    def scalar(self, sql: str, params: tuple | dict = ()) -> Any:
        with self._lock:
            row = self._conn.execute(sql, params).fetchone()
            return row[0] if row else None

    @contextmanager
    def tx(self) -> Iterator["Database"]:
        """Transaction; nested calls join the outer transaction."""
        with self._lock:
            outer = self._tx_depth == 0
            if outer:
                self._conn.execute("BEGIN IMMEDIATE")
            self._tx_depth += 1
            try:
                yield self
            except BaseException:
                self._tx_depth -= 1
                if outer:
                    self._conn.execute("ROLLBACK")
                raise
            else:
                self._tx_depth -= 1
                if outer:
                    self._conn.execute("COMMIT")

    def insert(self, table: str, values: dict[str, Any]) -> int:
        cols = ", ".join(values)
        marks = ", ".join(f":{k}" for k in values)
        cur = self.execute(f"INSERT INTO {table} ({cols}) VALUES ({marks})", values)
        return int(cur.lastrowid or 0)

    def update(self, table: str, key: str, key_value: Any, values: dict[str, Any]) -> int:
        if not values:
            return 0
        sets = ", ".join(f"{k} = :{k}" for k in values)
        params = dict(values)
        params["__key"] = key_value
        cur = self.execute(f"UPDATE {table} SET {sets} WHERE {key} = :__key", params)
        return cur.rowcount

    # ------------------------------------------------------------ migrations
    def schema_version(self) -> int:
        self.execute("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)")
        v = self.scalar("SELECT MAX(version) FROM schema_version")
        return int(v or 0)

    def migrate(self) -> list[int]:
        applied: list[int] = []
        current = self.schema_version()
        for version, sql in MIGRATIONS:
            if version <= current:
                continue
            with self.tx():
                for statement in _split_sql(sql):
                    self._conn.execute(statement)
                self._conn.execute("INSERT INTO schema_version (version) VALUES (?)", (version,))
            applied.append(version)
        return applied

    def backup_to(self, target: Path) -> None:
        with self._lock:
            dest = sqlite3.connect(str(target))
            try:
                self._conn.backup(dest)
            finally:
                dest.close()

    def close(self) -> None:
        with self._lock:
            self._conn.close()


def _split_sql(sql: str) -> list[str]:
    parts = [p.strip() for p in sql.split(";")]
    return [p for p in parts if p]
