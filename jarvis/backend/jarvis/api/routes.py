"""REST + streaming API. Every route except /api/health requires the local token."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from .. import __version__
from ..db.backup import make_backup
from ..db.database import dumps, now_iso
from ..llm.factory import build_provider
from ..memory.store import MemoryConflict
from ..security.auth import token_matches
from ..services import Services
from ..voice.engine import VoiceUnavailable
from .deps import require_token

public = APIRouter(prefix="/api")
api = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


# ===================================================================== system
@public.get("/health")
async def health() -> dict:
    return {"ok": True, "name": "JARVIS", "version": __version__}


@api.get("/system/status")
async def system_status(request: Request, s: Services = Depends(require_token)) -> dict:
    llm = await s.llm.health()
    return {
        "version": __version__,
        "llm": llm,
        "engine": s.engine.status(),
        "schema_version": s.db.schema_version(),
        "voice": request.app.state.voice.status(),
        "counts": {
            "memories": s.db.scalar("SELECT COUNT(*) FROM memories WHERE deleted_at IS NULL"),
            "missions_active": s.db.scalar(
                "SELECT COUNT(*) FROM missions WHERE status IN ('queued','planning','running','verifying',"
                "'awaiting_approval','blocked')"),
            "approvals_pending": s.db.scalar("SELECT COUNT(*) FROM approvals WHERE status='pending'"),
            "leads": s.db.scalar("SELECT COUNT(*) FROM leads"),
            "notifications_unread": s.db.scalar("SELECT COUNT(*) FROM notifications WHERE read_at IS NULL"),
        },
        "settings": {
            "provider": s.settings.llm_provider, "model": s.llm.model, "embed_model": s.settings.llm_embed_model,
            "base_url": s.settings.llm_base_url, "language": s.settings.language,
            "searxng_url": s.settings.searxng_url, "smtp_configured": bool(s.settings.smtp_host),
            "data_dir": str(s.settings.data_dir),
        },
    }


@api.get("/system/models")
async def system_models(s: Services = Depends(require_token)) -> dict:
    try:
        return {"models": await s.llm.list_models(), "current": s.llm.model}
    except Exception as exc:
        return {"models": [], "current": s.llm.model, "error": str(exc)}


class ModelChoice(BaseModel):
    model: str = Field(min_length=1, max_length=200)


@api.post("/system/model")
async def set_model(body: ModelChoice, s: Services = Depends(require_token)) -> dict:
    s.settings.llm_model = body.model
    if s.settings.llm_provider == "fake":
        s.llm.model = body.model
    else:
        s.set_llm(build_provider(s.settings, body.model))
    s.db.execute("INSERT INTO settings (key, value, updated_at) VALUES ('llm_model', ?, ?) "
                 "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                 (dumps(body.model), now_iso()))
    s.audit.record("user", "settings:model", "changed", target=body.model)
    return {"model": body.model, "health": await s.llm.health()}


@api.post("/system/backup")
async def backup(s: Services = Depends(require_token)) -> dict:
    path = make_backup(s.db, s.settings.backups_dir, s.settings.backup_keep)
    s.bus.emit("system.backup", file=path.name)
    return {"file": path.name}


@api.get("/system/audit")
async def audit(limit: int = 200, s: Services = Depends(require_token)) -> list:
    return s.audit.list(limit)


@api.get("/tools")
async def tools(s: Services = Depends(require_token)) -> list:
    return s.tools.catalog()


# ================================================================== dashboard
@api.get("/dashboard")
async def dashboard(hours: int = Query(48, ge=6, le=24 * 30), s: Services = Depends(require_token)) -> dict:
    """Real metrics for the Command Center. Nothing here is invented: an empty
    database returns zeros, and the UI shows them as such."""
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat(timespec="seconds")
    rows = s.db.query(
        "SELECT substr(ts, 1, 13) AS hour, "
        "SUM(CASE WHEN type LIKE 'task.%' THEN 1 ELSE 0 END) AS tasks, "
        "SUM(CASE WHEN type LIKE 'research.%' THEN 1 ELSE 0 END) AS research, "
        "SUM(CASE WHEN type LIKE 'lead.%' THEN 1 ELSE 0 END) AS leads, "
        "SUM(CASE WHEN type LIKE 'chat.%' THEN 1 ELSE 0 END) AS chat, "
        "SUM(CASE WHEN type LIKE 'dev.%' THEN 1 ELSE 0 END) AS dev, "
        "COUNT(*) AS total FROM events WHERE ts >= ? GROUP BY hour ORDER BY hour", (since,))
    by_hour = {r["hour"]: r for r in rows}
    start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0) - timedelta(hours=hours - 1)
    series = []
    for i in range(hours):
        h = (start + timedelta(hours=i)).isoformat()[:13]
        r = by_hour.get(h, {})
        series.append({"hour": h, **{k: int(r.get(k) or 0) for k in ("tasks", "research", "leads", "chat", "dev", "total")}})
    missions = s.missions.list(status="active", limit=20)
    mission_status = {r["status"]: r["n"] for r in s.db.query("SELECT status, COUNT(*) n FROM missions GROUP BY status")}
    task_status = {r["status"]: r["n"] for r in s.db.query("SELECT status, COUNT(*) n FROM tasks GROUP BY status")}
    return {
        "generated_at": now_iso(),
        "hours": hours,
        "activity": series,
        "missions_active": [{"id": m["id"], "objective": m["objective"][:140], "status": m["status"],
                             "progress": m["progress"], "steps_used": m["steps_used"], "max_steps": m["max_steps"],
                             "priority": m["priority"]} for m in missions],
        "mission_status": mission_status,
        "task_status": task_status,
        "sales": s.crm.stats(),
        "memory": {r["category"]: r["n"] for r in s.db.query(
            "SELECT category, COUNT(*) n FROM memories WHERE deleted_at IS NULL GROUP BY category")},
        "approvals_pending": s.db.scalar("SELECT COUNT(*) FROM approvals WHERE status='pending'"),
        "events_total": s.db.scalar("SELECT COUNT(*) FROM events"),
        "recent_events": s.bus.recent(limit=40),
        "engine": s.engine.status(),
    }


# ======================================================================= chat
@api.get("/conversations")
async def conversations(s: Services = Depends(require_token)) -> list:
    return s.chat.list()


@api.post("/conversations")
async def new_conversation(title: str = Body("Nuova conversazione", embed=True),
                           s: Services = Depends(require_token)) -> dict:
    return s.chat.create(title)


@api.get("/conversations/{cid}/messages")
async def conversation_messages(cid: str, s: Services = Depends(require_token)) -> list:
    return s.chat.messages(cid)


@api.patch("/conversations/{cid}")
async def rename_conversation(cid: str, title: str = Body(..., embed=True), s: Services = Depends(require_token)) -> dict:
    s.chat.rename(cid, title)
    return {"ok": True}


@api.delete("/conversations/{cid}")
async def delete_conversation(cid: str, s: Services = Depends(require_token)) -> dict:
    s.chat.delete(cid)
    return {"ok": True}


class ChatIn(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    conversation_id: str | None = None
    mode: str = Field("text", pattern="^(text|voice)$")


@api.post("/chat")
async def chat(body: ChatIn, s: Services = Depends(require_token)) -> StreamingResponse:
    async def stream():
        async for ev in s.chat.send(body.conversation_id, body.text, body.mode):
            yield f"data: {json.dumps(ev, ensure_ascii=False, default=str)}\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ===================================================================== memory
class MemoryIn(BaseModel):
    category: str
    title: str = Field(min_length=1, max_length=300)
    content: str = Field(min_length=1, max_length=20000)
    reliability: str = "user_provided"
    source: str | None = None
    tags: list[str] = []


class MemoryPatch(BaseModel):
    title: str | None = None
    content: str | None = None
    reliability: str | None = None
    change_note: str | None = None
    expected_version: int | None = None


@api.get("/memories")
async def memories(category: str | None = None, include_deleted: bool = False,
                   s: Services = Depends(require_token)) -> list:
    try:
        return s.memory.list(category, include_deleted)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@api.get("/memories/search")
async def memory_search(q: str, limit: int = 10, s: Services = Depends(require_token)) -> list:
    return await s.memory.search(q, limit)


@api.post("/memories")
async def memory_create(body: MemoryIn, s: Services = Depends(require_token)) -> dict:
    try:
        return await s.memory.create(body.category, body.title, body.content, body.reliability,
                                     body.source, body.tags, actor="user")
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@api.get("/memories/{mid}")
async def memory_get(mid: str, s: Services = Depends(require_token)) -> dict:
    m = s.memory.get(mid, include_deleted=True)
    if not m:
        raise HTTPException(404, "Memory not found")
    return {**m, "revisions": s.memory.revisions(mid)}


@api.patch("/memories/{mid}")
async def memory_update(mid: str, body: MemoryPatch, s: Services = Depends(require_token)) -> dict:
    try:
        return await s.memory.update(mid, title=body.title, content=body.content, reliability=body.reliability,
                                     change_note=body.change_note, expected_version=body.expected_version,
                                     actor="user")
    except KeyError as exc:
        raise HTTPException(404, "Memory not found") from exc
    except MemoryConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@api.delete("/memories/{mid}")
async def memory_delete(mid: str, purge: bool = False, s: Services = Depends(require_token)) -> dict:
    ok = s.memory.purge(mid) if purge else s.memory.delete(mid)
    if ok:
        s.audit.record("user", "memory:purge" if purge else "memory:delete", "done", target=mid)
    return {"ok": ok}


@api.post("/memories/{mid}/restore")
async def memory_restore(mid: str, s: Services = Depends(require_token)) -> dict:
    return {"ok": s.memory.restore(mid)}


# ================================================================== knowledge
@api.get("/knowledge")
async def knowledge_list(s: Services = Depends(require_token)) -> list:
    return s.knowledge.list()


@api.get("/knowledge/{name:path}")
async def knowledge_read(name: str, s: Services = Depends(require_token)) -> dict:
    try:
        return {"name": name, "content": s.knowledge.read(name)}
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(404, str(exc)) from exc


@api.put("/knowledge/{name:path}")
async def knowledge_write(name: str, content: str = Body(..., embed=True), s: Services = Depends(require_token)) -> dict:
    try:
        s.knowledge.write(name, content)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True}


@api.delete("/knowledge/{name:path}")
async def knowledge_delete(name: str, s: Services = Depends(require_token)) -> dict:
    try:
        s.knowledge.delete(name)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True}


# =================================================================== missions
class MissionIn(BaseModel):
    objective: str = Field(min_length=3, max_length=4000)
    priority: int = 5
    kind: str = "auto"
    params: dict[str, Any] = {}
    max_steps: int | None = Field(None, ge=1, le=500)
    max_seconds: int | None = Field(None, ge=60, le=7 * 24 * 3600)


@api.get("/missions")
async def missions(status: str | None = None, s: Services = Depends(require_token)) -> list:
    return s.missions.list(status)


@api.post("/missions")
async def mission_create(body: MissionIn, s: Services = Depends(require_token)) -> dict:
    if body.kind not in ("auto", "lead_acquisition", "website_audit", "freeform"):
        raise HTTPException(400, "Unknown mission kind")
    return s.missions.create(body.objective, kind=body.kind, params=body.params, priority=body.priority,
                             max_steps=body.max_steps, max_seconds=body.max_seconds)


@api.get("/missions/{mid}")
async def mission_get(mid: str, s: Services = Depends(require_token)) -> dict:
    m = s.missions.detail(mid)
    if not m:
        raise HTTPException(404, "Mission not found")
    return m


@api.post("/missions/{mid}/cancel")
async def mission_cancel(mid: str, s: Services = Depends(require_token)) -> dict:
    return {"ok": s.missions.cancel(mid)}


@api.post("/missions/{mid}/resume")
async def mission_resume(mid: str, extra_steps: int = Body(10, embed=True), s: Services = Depends(require_token)) -> dict:
    return {"ok": s.missions.resume(mid, extra_steps)}


@api.get("/approvals")
async def approvals(status: str | None = "pending", s: Services = Depends(require_token)) -> list:
    return s.missions.approvals(status if status != "all" else None)


class Decision(BaseModel):
    approve: bool
    note: str | None = None
    confirmation: str | None = None


@api.post("/approvals/{aid}")
async def approval_decide(aid: str, body: Decision, s: Services = Depends(require_token)) -> dict:
    try:
        return await s.engine.decide(aid, body.approve, body.note, body.confirmation)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc


class ScheduleIn(BaseModel):
    objective: str = Field(min_length=3, max_length=4000)
    interval_hours: int = Field(24, ge=1, le=24 * 30)


@api.get("/schedules")
async def schedules(s: Services = Depends(require_token)) -> list:
    return s.missions.schedules()


@api.post("/schedules")
async def schedule_create(body: ScheduleIn, s: Services = Depends(require_token)) -> dict:
    return s.missions.add_schedule(body.objective, body.interval_hours * 3600)


@api.delete("/schedules/{sid}")
async def schedule_delete(sid: str, s: Services = Depends(require_token)) -> dict:
    s.db.execute("DELETE FROM schedules WHERE id = ?", (sid,))
    return {"ok": True}


# ====================================================================== sales
class LeadIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    website: str | None = None
    sector: str | None = None
    city: str | None = None
    country: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None


class LeadPatch(BaseModel):
    status: str | None = None
    next_action: str | None = None
    legal_basis: str | None = None
    notes: str | None = None
    email: str | None = None
    phone: str | None = None


@api.get("/leads")
async def leads(status: str | None = None, mission_id: str | None = None, s: Services = Depends(require_token)) -> list:
    return s.crm.list(status, mission_id)


@api.post("/leads")
async def lead_create(body: LeadIn, s: Services = Depends(require_token)) -> dict:
    return s.crm.create_manual(body.model_dump())


@api.get("/leads/{lid}")
async def lead_get(lid: str, s: Services = Depends(require_token)) -> dict:
    lead = s.crm.get(lid)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return {**lead, "interactions": s.crm.interactions(lid), "drafts": s.crm.drafts(lid), "deals": s.crm.deals(lid)}


@api.patch("/leads/{lid}")
async def lead_update(lid: str, body: LeadPatch, s: Services = Depends(require_token)) -> dict:
    try:
        return s.crm.update(lid, actor="user", **body.model_dump(exclude_none=True))
    except KeyError as exc:
        raise HTTPException(404, "Lead not found") from exc
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@api.post("/leads/{lid}/interactions")
async def lead_interaction(lid: str, channel: str = Body(...), summary: str = Body(...),
                           direction: str = Body("out"), s: Services = Depends(require_token)) -> dict:
    s.crm.add_interaction(lid, channel, direction, summary)
    return {"ok": True}


@api.get("/sales/stats")
async def sales_stats(s: Services = Depends(require_token)) -> dict:
    return s.crm.stats()


@api.get("/drafts")
async def drafts(status: str | None = None, s: Services = Depends(require_token)) -> list:
    return s.crm.drafts(status=status)


class DraftPatch(BaseModel):
    subject: str | None = None
    body: str | None = None
    status: str | None = None


@api.patch("/drafts/{did}")
async def draft_update(did: str, body: DraftPatch, s: Services = Depends(require_token)) -> dict:
    if body.status == "sent":
        raise HTTPException(400, "A draft becomes 'sent' only through the approved send action")
    try:
        d = s.crm.update_draft(did, **body.model_dump(exclude_none=True))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if not d:
        raise HTTPException(404, "Draft not found")
    return d


@api.post("/leads/{lid}/deals")
async def deal_create(lid: str, title: str = Body(...), amount_eur: float | None = Body(None),
                      s: Services = Depends(require_token)) -> dict:
    return s.crm.add_deal(lid, title, amount_eur)


@api.post("/deals/{did}/verify")
async def deal_verify(did: str, payment_reference: str = Body(..., embed=True), s: Services = Depends(require_token)) -> dict:
    try:
        deal = s.crm.verify_payment(did, payment_reference)
    except (KeyError, ValueError) as exc:
        raise HTTPException(400, str(exc)) from exc
    s.audit.record("user", "deal:verify_payment", "verified", target=did, reference=payment_reference)
    return deal


@api.get("/deals")
async def deals(s: Services = Depends(require_token)) -> list:
    return s.crm.deals()


# ======================================================================== dev
class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = ""


@api.get("/projects")
async def projects(s: Services = Depends(require_token)) -> list:
    return s.workspaces.list()


@api.post("/projects")
async def project_create(body: ProjectIn, s: Services = Depends(require_token)) -> dict:
    from ..departments.dev.workspace import WorkspaceError
    try:
        return s.workspaces.create(body.name, body.description)
    except WorkspaceError as exc:
        raise HTTPException(400, str(exc)) from exc


@api.get("/projects/{pid}/files")
async def project_files(pid: str, s: Services = Depends(require_token)) -> list:
    from ..departments.dev.workspace import WorkspaceError
    try:
        return s.workspaces.files(pid)
    except WorkspaceError as exc:
        raise HTTPException(404, str(exc)) from exc


@api.get("/projects/{pid}/file")
async def project_file(pid: str, path: str, s: Services = Depends(require_token)) -> dict:
    from ..departments.dev.workspace import WorkspaceError
    try:
        return {"path": path, "content": s.workspaces.read(pid, path)}
    except WorkspaceError as exc:
        raise HTTPException(400, str(exc)) from exc


@api.put("/projects/{pid}/file")
async def project_file_write(pid: str, path: str = Body(...), content: str = Body(...),
                             s: Services = Depends(require_token)) -> dict:
    from ..departments.dev.workspace import WorkspaceError
    try:
        return s.workspaces.write(pid, path, content)
    except WorkspaceError as exc:
        raise HTTPException(400, str(exc)) from exc


@api.post("/projects/{pid}/run")
async def project_run(pid: str, argv: list[str] = Body(..., embed=True), s: Services = Depends(require_token)) -> dict:
    from ..departments.dev.workspace import WorkspaceError
    try:
        return await s.workspaces.run(pid, argv)
    except WorkspaceError as exc:
        raise HTTPException(400, str(exc)) from exc


@api.get("/projects/{pid}/runs")
async def project_runs(pid: str, s: Services = Depends(require_token)) -> list:
    return s.workspaces.runs(pid)


# ============================================================ notifications
@api.get("/notifications")
async def notifications(unread: bool = False, s: Services = Depends(require_token)) -> list:
    sql = "SELECT * FROM notifications" + (" WHERE read_at IS NULL" if unread else "") + " ORDER BY id DESC LIMIT 100"
    return s.db.query(sql)


@api.post("/notifications/read")
async def notifications_read(ids: list[int] | None = Body(None, embed=True), s: Services = Depends(require_token)) -> dict:
    if ids:
        for i in ids:
            s.db.execute("UPDATE notifications SET read_at = ? WHERE id = ?", (now_iso(), i))
    else:
        s.db.execute("UPDATE notifications SET read_at = ? WHERE read_at IS NULL", (now_iso(),))
    return {"ok": True}


# ===================================================================== events
@api.get("/events")
async def events(after_id: int = 0, type: str | None = None, limit: int = Query(200, le=2000),
                 s: Services = Depends(require_token)) -> list:
    return s.bus.recent(limit=limit, type_prefix=type, after_id=after_id)


@api.post("/events/voice")
async def voice_state(state: str = Body(..., embed=True), s: Services = Depends(require_token)) -> dict:
    if state not in ("idle", "listening", "thinking", "speaking"):
        raise HTTPException(400, "Invalid state")
    s.bus.emit("voice.state", state=state)
    return {"ok": True}


@public.websocket("/ws")
async def websocket(ws: WebSocket) -> None:
    """Live events. The token is sent as the first message, never in the URL,
    so it cannot end up in access logs or browser history."""
    s: Services = ws.app.state.services
    await ws.accept()
    try:
        first = await asyncio.wait_for(ws.receive_text(), timeout=5)
        token = json.loads(first).get("token") if first.startswith("{") else None
    except (asyncio.TimeoutError, WebSocketDisconnect, ValueError):
        token = None
    if not token_matches(s.token, token):
        await ws.close(code=4401)
        return
    q = s.bus.subscribe()
    try:
        await ws.send_text(json.dumps({"type": "hello", "payload": {"version": __version__}}))
        while True:
            try:
                ev = await asyncio.wait_for(q.get(), timeout=25)
                await ws.send_text(json.dumps(ev, ensure_ascii=False, default=str))
            except asyncio.TimeoutError:
                await ws.send_text(json.dumps({"type": "ping"}))
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        s.bus.unsubscribe(q)


# ====================================================================== voice
@api.get("/voice/status")
async def voice_status(request: Request) -> dict:
    return request.app.state.voice.status()


@api.post("/voice/stt")
async def voice_stt(request: Request, language: str | None = None) -> dict:
    audio = await request.body()
    if not audio:
        raise HTTPException(400, "Empty audio")
    if len(audio) > 25_000_000:
        raise HTTPException(413, "Audio too large")
    ctype = request.headers.get("content-type", "audio/webm")
    suffix = ".wav" if "wav" in ctype else ".ogg" if "ogg" in ctype else ".webm"
    try:
        return await request.app.state.voice.transcribe(audio, suffix, language)
    except VoiceUnavailable as exc:
        raise HTTPException(501, str(exc)) from exc


@api.post("/voice/tts")
async def voice_tts(request: Request, text: str = Body(..., embed=True)) -> Response:
    try:
        audio, media_type = await request.app.state.voice.speak(text)
    except VoiceUnavailable as exc:
        raise HTTPException(501, str(exc)) from exc
    return Response(audio, media_type=media_type,
                    headers={"X-Jarvis-Voice": request.app.state.voice.last_engine or ""})
