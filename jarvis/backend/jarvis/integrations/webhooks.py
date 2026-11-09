"""Minimal public-facing app: only /webhooks/*. Run on its own port so a tunnel
(e.g. cloudflared) exposes nothing else of JARVIS."""

from __future__ import annotations

import asyncio
import hmac
import json
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import PlainTextResponse

from .vault import secret
from .whatsapp import parse_webhook, verify_signature


def create_webhook_app(services: Any) -> FastAPI:
    app = FastAPI(title="JARVIS webhooks", docs_url=None, redoc_url=None, openapi_url=None)
    tasks: set[asyncio.Task] = set()

    @app.get("/webhooks/health")
    async def health() -> dict:
        return {"ok": True}

    @app.get("/webhooks/whatsapp")
    async def verify(request: Request) -> PlainTextResponse:
        q = request.query_params
        expected = secret(services, "whatsapp_verify_token") or ""
        if q.get("hub.mode") == "subscribe" and expected and hmac.compare_digest(q.get("hub.verify_token", ""), expected):
            return PlainTextResponse(q.get("hub.challenge", ""))
        raise HTTPException(403, "verification failed")

    @app.post("/webhooks/whatsapp")
    async def receive(request: Request) -> dict:
        raw = await request.body()
        if not verify_signature(raw, request.headers.get("x-hub-signature-256"), secret(services, "whatsapp_app_secret")):
            services.bus.emit("security.webhook_rejected", source="whatsapp")
            raise HTTPException(401, "invalid signature")
        try:
            payload = json.loads(raw)
        except ValueError as exc:
            raise HTTPException(400, "invalid json") from exc
        for msg in parse_webhook(payload):
            task = asyncio.create_task(services.channels.whatsapp_inbound(msg))
            tasks.add(task)
            task.add_done_callback(tasks.discard)
        return {"ok": True}  # answer fast; Meta retries slow webhooks

    return app
