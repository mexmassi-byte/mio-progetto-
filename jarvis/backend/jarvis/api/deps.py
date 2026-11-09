from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status

from ..security.auth import token_matches
from ..services import Services


def get_services(request: Request) -> Services:
    return request.app.state.services


def require_token(request: Request, services: Services = Depends(get_services)) -> Services:
    header = request.headers.get("authorization", "")
    provided = header[7:] if header.lower().startswith("bearer ") else request.headers.get("x-jarvis-token")
    if not token_matches(services.token, provided):
        _failed_access(services, request)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing JARVIS token")
    return services


def _failed_access(services: Services, request: Request) -> None:
    """Repeated invalid tokens are a security event (alert at the 10th in 15 minutes)."""
    from datetime import datetime, timedelta, timezone
    services.bus.emit("security.auth_failed", path=request.url.path,
                      client=request.client.host if request.client else None)
    since = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat(timespec="seconds")
    n = services.db.scalar("SELECT COUNT(*) FROM events WHERE type = 'security.auth_failed' AND ts >= ?", (since,))
    if n == 10:
        from ..tools.builtin import notify
        notify(services, "Allarme sicurezza", f"{n} tentativi di accesso con token non valido in 15 minuti.",
               "critical", call_event="security")
