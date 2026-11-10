"""Application entry point and command-line interface.

    jarvis              start the server (http://127.0.0.1:8765)
    jarvis token        print the local access token
    jarvis doctor       check model, search service, tools
    jarvis eval         run the model evaluation suite
    jarvis backup       back up the database now
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from .config import Settings, get_settings
from .db.backup import latest_backup, make_backup
from .llm.base import LLMProvider
from .services import Services, build_services
from .voice.engine import VoiceEngine

log = logging.getLogger("jarvis")
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
CSP = ("default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data: blob:; media-src 'self' blob:; "
       "style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; object-src 'none'; "
       "frame-ancestors 'none'; base-uri 'none'")


def setup_logging(settings: Settings) -> None:
    settings.ensure_dirs()
    root = logging.getLogger()
    if any(isinstance(h, RotatingFileHandler) for h in root.handlers):
        return
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    fh = RotatingFileHandler(settings.logs_dir / "jarvis.log", maxBytes=5_000_000, backupCount=5, encoding="utf-8")
    fh.setFormatter(fmt)
    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    root.addHandler(fh)
    root.addHandler(sh)
    root.setLevel(logging.INFO)


async def _daily_backups(services: Services) -> None:
    from datetime import datetime
    while True:
        last = latest_backup(services.settings.backups_dir)
        age_h = (datetime.now().timestamp() - last.stat().st_mtime) / 3600 if last else 999
        if age_h >= 24:
            try:
                path = make_backup(services.db, services.settings.backups_dir, services.settings.backup_keep)
                services.bus.emit("system.backup", file=path.name)
            except Exception:
                log.exception("backup failed")
        await asyncio.sleep(3600)


async def _start_webhooks(services: Services):
    """Separate server exposing only /webhooks/* (for a public tunnel), started
    when WhatsApp is configured. The dashboard/API stay local-only."""
    if not services.channels.whatsapp.configured():
        return None
    import uvicorn
    from .integrations.webhooks import create_webhook_app
    st = services.settings
    server = uvicorn.Server(uvicorn.Config(create_webhook_app(services), host=st.webhook_host,
                                           port=st.webhook_port, log_level="warning"))
    server.install_signal_handlers = lambda: None  # type: ignore[method-assign]
    asyncio.create_task(server.serve())
    log.info("WhatsApp webhook server on http://%s:%s/webhooks/whatsapp", st.webhook_host, st.webhook_port)
    return server


def create_app(settings: Settings | None = None, llm: LLMProvider | None = None,
               start_engine: bool | None = None) -> FastAPI:
    settings = settings or get_settings()
    services = build_services(settings, llm)

    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI):
        services.bus.bind_loop(asyncio.get_running_loop())
        services.bus.emit("system.started", version=__version__, model=services.llm.model)
        run_engine = settings.engine_enabled if start_engine is None else start_engine
        if run_engine:
            services.engine.start()
        backups = asyncio.create_task(_daily_backups(services))
        app.state.warm_up = asyncio.create_task(services.chat.warm_up())  # first answer without the wait
        webhook_server = await _start_webhooks(services)
        await app.state.wake.apply()
        try:
            yield
        finally:
            backups.cancel()
            if webhook_server:
                webhook_server.should_exit = True
            await app.state.wake.stop()
            await services.engine.stop()
            services.db.close()

    app = FastAPI(title="JARVIS", version=__version__, lifespan=lifespan,
                  docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.state.services = services
    app.state.voice = services.voice
    from .voice.wake import WakeService
    app.state.wake = WakeService(services)
    app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins, allow_credentials=False,
                       allow_methods=["*"], allow_headers=["*"])

    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        if not request.url.path.startswith("/api/"):
            response.headers.setdefault("Content-Security-Policy", CSP)
        return response

    from .api.routes import api, public
    app.include_router(public)
    app.include_router(api)

    if FRONTEND_DIST.exists():
        app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        async def spa(path: str):
            candidate = (FRONTEND_DIST / path).resolve()
            if path and FRONTEND_DIST in candidate.parents and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(FRONTEND_DIST / "index.html")
    return app


def run() -> None:
    args = sys.argv[1:]
    settings = get_settings()
    setup_logging(settings)
    cmd = args[0] if args else "serve"
    if cmd == "token":
        from .security.auth import load_or_create_token
        settings.ensure_dirs()
        print(load_or_create_token(settings.token_path))
        return
    if cmd == "backup":
        services = build_services(settings)
        print(make_backup(services.db, settings.backups_dir, settings.backup_keep))
        return
    if cmd == "doctor":
        from .doctor import doctor
        asyncio.run(doctor(settings))
        return
    if cmd == "eval":
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from evals.run_evals import main as eval_main
        asyncio.run(eval_main(args[1:]))
        return
    if cmd not in ("serve", "start"):
        print(__doc__)
        return
    if settings.host not in ("127.0.0.1", "localhost", "::1"):
        log.warning("JARVIS is listening on %s: it is reachable from other devices on the network", settings.host)
    import uvicorn
    app = create_app(settings)
    token = app.state.services.token
    print(f"\n  JARVIS {__version__}  →  http://{settings.host}:{settings.port}\n  Token: {token}\n")
    uvicorn.run(app, host=settings.host, port=settings.port, log_level="info")


if __name__ == "__main__":
    run()
