"""Event bus.

Every meaningful action becomes an event: persisted in SQLite (so the
dashboard can chart real history) and pushed to WebSocket subscribers (so the
visuals react live). The visual modes are driven *only* by these events.

Event types (``type`` field):
  chat.*         chat.started, chat.finished
  mission.*      created, started, planned, completed, failed, cancelled, blocked
  task.*         started, succeeded, failed, retrying, awaiting_approval
  research.*     search, source, location, analyze, evaluate, organize, done
  lead.*         created, audited, scored, status
  memory.*       created, updated, deleted
  approval.*     requested, decided
  voice.*        state (idle/listening/thinking/speaking)
  notify         user-facing notification
  system.*       started, backup, error
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from .db.database import Database, dumps, loads, now_iso

log = logging.getLogger("jarvis.events")


class EventBus:
    def __init__(self, db: Database):
        self.db = db
        self._subscribers: set[asyncio.Queue] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def emit(self, type_: str, **payload: Any) -> dict[str, Any]:
        ts = now_iso()
        event_id = self.db.insert("events", {"ts": ts, "type": type_, "payload": dumps(payload)})
        event = {"id": event_id, "ts": ts, "type": type_, "payload": payload}
        self._broadcast(event)
        return event

    def _broadcast(self, event: dict[str, Any]) -> None:
        if not self._subscribers:
            return
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        for q in list(self._subscribers):
            if running is not None and (self._loop is None or running is self._loop):
                _put(q, event)
            elif self._loop is not None:
                self._loop.call_soon_threadsafe(_put, q, event)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    def recent(self, limit: int = 200, type_prefix: str | None = None, after_id: int = 0) -> list[dict]:
        if type_prefix:
            rows = self.db.query(
                "SELECT * FROM events WHERE id > ? AND type LIKE ? ORDER BY id DESC LIMIT ?",
                (after_id, type_prefix + "%", limit),
            )
        else:
            rows = self.db.query(
                "SELECT * FROM events WHERE id > ? ORDER BY id DESC LIMIT ?", (after_id, limit)
            )
        return [{**r, "payload": loads(r["payload"], {})} for r in reversed(rows)]


def _put(q: asyncio.Queue, event: dict) -> None:
    try:
        q.put_nowait(event)
    except asyncio.QueueFull:  # slow client: drop oldest
        try:
            q.get_nowait()
            q.put_nowait(event)
        except (asyncio.QueueEmpty, asyncio.QueueFull):
            pass
