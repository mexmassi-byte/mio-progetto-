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
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing JARVIS token")
    return services
