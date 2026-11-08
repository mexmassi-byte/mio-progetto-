"""Persistent memory.

* Structured memories in SQLite, each with a category and a reliability label.
* Every change creates a revision: nothing is overwritten silently, and the
  previous text can always be restored.
* Deletion is soft by default (recoverable); ``purge`` removes for good.
* Optional semantic search with local embeddings; keyword search otherwise.
"""

from __future__ import annotations

import math
from enum import Enum
from typing import Any

from ..db.database import Database, dumps, loads, new_id, now_iso
from ..events import EventBus
from ..llm.base import LLMProvider


class Category(str, Enum):
    USER_PREFERENCE = "user_preference"
    COMPANY = "company"
    STRATEGY = "strategy"
    CUSTOMER = "customer"
    PROJECT = "project"
    TASK = "task"
    DECISION = "decision"
    PROCEDURE = "procedure"
    LESSON = "lesson"


class Reliability(str, Enum):
    VERIFIED = "verified"          # checked against a reliable source
    USER_PROVIDED = "user_provided"  # stated by the user
    ESTIMATE = "estimate"
    ASSUMPTION = "assumption"
    OUTDATED = "outdated"


# Categories whose content is "important business information": an automatic
# (non-user) update is stored as a *proposal* revision instead of replacing it.
PROTECTED = {Category.COMPANY, Category.STRATEGY, Category.CUSTOMER, Category.DECISION}


class MemoryConflict(Exception):
    pass


class MemoryStore:
    def __init__(self, db: Database, bus: EventBus | None = None, llm: LLMProvider | None = None):
        self.db = db
        self.bus = bus
        self.llm = llm

    # ------------------------------------------------------------------ CRUD
    async def create(self, category: str, title: str, content: str, reliability: str,
                     source: str | None = None, tags: list[str] | None = None,
                     actor: str = "user") -> dict[str, Any]:
        cat = Category(category)
        rel = Reliability(reliability)
        title, content = title.strip(), content.strip()
        if actor != "user":
            # Only the user can certify a fact as verified. JARVIS may record
            # what the user said, or its own estimate, never a "verified" fact.
            if rel is Reliability.VERIFIED:
                rel = Reliability.USER_PROVIDED if actor == "jarvis-chat" else Reliability.ESTIMATE
            dup = self.db.one(
                "SELECT id FROM memories WHERE deleted_at IS NULL AND category = ? AND title = ? AND content = ?",
                (cat.value, title, content))
            if dup:
                return self.get(dup["id"])  # type: ignore[return-value]
        mid = new_id("mem")
        ts = now_iso()
        embedding = await self._embed(f"{title}\n{content}")
        with self.db.tx():
            self.db.insert("memories", {
                "id": mid, "category": cat.value, "title": title, "content": content,
                "reliability": rel.value, "source": source, "tags": dumps(tags or []), "version": 1,
                "embedding": dumps(embedding) if embedding else None,
                "created_at": ts, "updated_at": ts, "deleted_at": None,
            })
            self._revision(mid, 1, title, content, rel.value, "created", actor)
        self._emit("memory.created", id=mid, category=cat.value, title=title)
        return self.get(mid)  # type: ignore[return-value]

    def get(self, memory_id: str, include_deleted: bool = False) -> dict[str, Any] | None:
        row = self.db.one("SELECT * FROM memories WHERE id = ?", (memory_id,))
        if not row or (row["deleted_at"] and not include_deleted):
            return None
        return _public(row)

    def list(self, category: str | None = None, include_deleted: bool = False,
             limit: int = 500) -> list[dict[str, Any]]:
        where, params = [], []
        if category:
            where.append("category = ?")
            params.append(Category(category).value)
        if not include_deleted:
            where.append("deleted_at IS NULL")
        sql = "SELECT * FROM memories"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY updated_at DESC LIMIT ?"
        params.append(limit)
        return [_public(r) for r in self.db.query(sql, tuple(params))]

    async def update(self, memory_id: str, *, title: str | None = None, content: str | None = None,
                     reliability: str | None = None, change_note: str | None = None,
                     expected_version: int | None = None, actor: str = "user") -> dict[str, Any]:
        row = self.db.one("SELECT * FROM memories WHERE id = ? AND deleted_at IS NULL", (memory_id,))
        if not row:
            raise KeyError(memory_id)
        if expected_version is not None and expected_version != row["version"]:
            raise MemoryConflict(
                f"Memory changed meanwhile (version {row['version']}, you edited {expected_version})"
            )
        new_title = (title if title is not None else row["title"]).strip()
        new_content = (content if content is not None else row["content"]).strip()
        new_rel = Reliability(reliability).value if reliability else row["reliability"]

        if actor != "user" and Category(row["category"]) in PROTECTED:
            # Never overwrite important business info automatically.
            self._revision(memory_id, row["version"], new_title, new_content, new_rel,
                           f"PROPOSAL (not applied): {change_note or ''}".strip(), actor)
            self._emit("memory.proposal", id=memory_id, title=row["title"], actor=actor)
            return {**_public(row), "proposal_pending": True}

        version = row["version"] + 1
        embedding = await self._embed(f"{new_title}\n{new_content}")
        with self.db.tx():
            self.db.update("memories", "id", memory_id, {
                "title": new_title, "content": new_content, "reliability": new_rel,
                "version": version, "updated_at": now_iso(),
                "embedding": dumps(embedding) if embedding else row["embedding"],
            })
            self._revision(memory_id, version, new_title, new_content, new_rel,
                           change_note or "updated", actor)
        self._emit("memory.updated", id=memory_id, version=version)
        return self.get(memory_id)  # type: ignore[return-value]

    def delete(self, memory_id: str, actor: str = "user") -> bool:
        n = self.db.update("memories", "id", memory_id, {"deleted_at": now_iso()})
        if n:
            self._emit("memory.deleted", id=memory_id, actor=actor)
        return bool(n)

    def restore(self, memory_id: str) -> bool:
        return bool(self.db.update("memories", "id", memory_id, {"deleted_at": None}))

    def purge(self, memory_id: str) -> bool:
        cur = self.db.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
        return cur.rowcount > 0

    def revisions(self, memory_id: str) -> list[dict[str, Any]]:
        return self.db.query(
            "SELECT * FROM memory_revisions WHERE memory_id = ? ORDER BY id DESC", (memory_id,)
        )

    # ---------------------------------------------------------------- search
    async def search(self, query: str, limit: int = 8, category: str | None = None) -> list[dict[str, Any]]:
        items = self.db.query(
            "SELECT * FROM memories WHERE deleted_at IS NULL"
            + (" AND category = ?" if category else ""),
            (Category(category).value,) if category else (),
        )
        if not items or not query.strip():
            return []
        qvec = await self._embed(query)
        terms = [t for t in _tokens(query) if len(t) > 2]
        scored = []
        for r in items:
            kw = _keyword_score(terms, f"{r['title']} {r['content']} {r['tags'] or ''}")
            sem = 0.0
            vec = loads(r["embedding"])
            if qvec and vec and len(vec) == len(qvec):
                sem = _cosine(qvec, vec)
            score = kw + sem * 2.0
            if r["reliability"] == Reliability.OUTDATED.value:
                score *= 0.5
            if score > 0.15:
                scored.append((score, r))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [{**_public(r), "score": round(s, 3)} for s, r in scored[:limit]]

    # --------------------------------------------------------------- helpers
    async def _embed(self, text: str) -> list[float] | None:
        if not self.llm:
            return None
        try:
            vecs = await self.llm.embed([text])
        except Exception:  # embeddings are optional
            return None
        return vecs[0] if vecs else None

    def _revision(self, mid: str, version: int, title: str, content: str, rel: str,
                  note: str, actor: str) -> None:
        self.db.insert("memory_revisions", {
            "memory_id": mid, "version": version, "title": title, "content": content,
            "reliability": rel, "change_note": note, "changed_by": actor, "changed_at": now_iso(),
        })

    def _emit(self, type_: str, **payload: Any) -> None:
        if self.bus:
            self.bus.emit(type_, **payload)


def _public(row: dict[str, Any]) -> dict[str, Any]:
    out = {k: v for k, v in row.items() if k != "embedding"}
    out["tags"] = loads(row.get("tags"), [])
    out["has_embedding"] = bool(row.get("embedding"))
    return out


def _tokens(text: str) -> list[str]:
    word = []
    out = []
    for ch in text.lower():
        if ch.isalnum():
            word.append(ch)
        elif word:
            out.append("".join(word))
            word = []
    if word:
        out.append("".join(word))
    return out


def _keyword_score(terms: list[str], text: str) -> float:
    if not terms:
        return 0.0
    words = set(_tokens(text))
    hits = sum(1 for t in terms if t in words or any(w.startswith(t) for w in words))
    return hits / len(terms)


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0
