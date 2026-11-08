"""Tool registry.

A tool is a Python coroutine with a JSON-schema for its arguments and a fixed
permission level. The registry validates arguments, refuses to run a
non-autonomous tool without an approval, enforces a timeout and writes the
audit log for tools with external effects.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Awaitable, Callable

from ..llm.base import ToolSpec
from ..security.permissions import Permission

if TYPE_CHECKING:  # pragma: no cover
    from ..services import Services


class ToolError(Exception):
    """A tool failed. ``retryable`` tells the engine whether to try again."""

    def __init__(self, message: str, retryable: bool = True):
        super().__init__(message)
        self.retryable = retryable


class PermissionDenied(ToolError):
    def __init__(self, message: str):
        super().__init__(message, retryable=False)


@dataclass
class ToolContext:
    services: "Services"
    actor: str = "jarvis"
    mission_id: str | None = None
    task_id: str | None = None
    approved: bool = False
    previous: dict[int, Any] = field(default_factory=dict)  # seq -> result
    checkpoint: dict[str, Any] = field(default_factory=dict)

    def emit(self, type_: str, **payload: Any) -> None:
        if self.mission_id:
            payload.setdefault("mission_id", self.mission_id)
        self.services.bus.emit(type_, **payload)


Handler = Callable[..., Awaitable[Any]]


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict[str, Any]
    handler: Handler
    permission: Permission = Permission.AUTONOMOUS
    external: bool = False  # touches the outside world (audit-logged)
    timeout_s: int = 300
    category: str = "general"
    plannable: bool = True  # may appear in automatically generated plans

    def spec(self) -> ToolSpec:
        return ToolSpec(self.name, self.description, self.parameters)


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> Tool:
        if tool.name in self._tools:
            raise ValueError(f"Tool already registered: {tool.name}")
        self._tools[tool.name] = tool
        return tool

    def tool(self, name: str, description: str, parameters: dict[str, Any] | None = None,
             permission: Permission = Permission.AUTONOMOUS, **kw: Any) -> Callable[[Handler], Handler]:
        def deco(fn: Handler) -> Handler:
            self.register(Tool(name, description, parameters or {"type": "object", "properties": {}},
                               fn, permission, **kw))
            return fn
        return deco

    def get(self, name: str) -> Tool:
        if name not in self._tools:
            raise ToolError(f"Unknown tool: {name}", retryable=False)
        return self._tools[name]

    def has(self, name: str) -> bool:
        return name in self._tools

    def all(self) -> list[Tool]:
        return list(self._tools.values())

    def specs(self, max_permission: Permission = Permission.APPROVAL,
              plannable_only: bool = False, names: list[str] | None = None) -> list[ToolSpec]:
        out = []
        for t in self._tools.values():
            if t.permission.rank > max_permission.rank:
                continue
            if plannable_only and not t.plannable:
                continue
            if names is not None and t.name not in names:
                continue
            out.append(t.spec())
        return out

    def catalog(self) -> list[dict[str, Any]]:
        return [
            {"name": t.name, "description": t.description, "permission": t.permission.value,
             "external": t.external, "category": t.category, "parameters": t.parameters}
            for t in self._tools.values()
        ]

    async def execute(self, name: str, args: dict[str, Any], ctx: ToolContext,
                      timeout_s: int | None = None) -> Any:
        tool = self.get(name)
        timeout = timeout_s or tool.timeout_s
        args = validate_args(tool.parameters, args or {})
        if tool.permission is not Permission.AUTONOMOUS and not ctx.approved:
            raise PermissionDenied(f"Tool '{name}' requires {tool.permission.value} permission")
        audit = ctx.services.audit
        if tool.external:
            audit.record(ctx.actor, f"tool:{name}", "started", target=_target(args),
                         permission=tool.permission.value, mission_id=ctx.mission_id, args=args)
        try:
            result = await asyncio.wait_for(tool.handler(ctx, **args), timeout=timeout)
        except asyncio.TimeoutError as exc:
            if tool.external:
                audit.record(ctx.actor, f"tool:{name}", "timeout", target=_target(args))
            raise ToolError(f"Tool '{name}' timed out after {timeout}s") from exc
        except ToolError as exc:
            if tool.external:
                audit.record(ctx.actor, f"tool:{name}", "failed", target=_target(args), error=str(exc))
            raise
        if tool.external:
            audit.record(ctx.actor, f"tool:{name}", "succeeded", target=_target(args))
        return result


def _target(args: dict[str, Any]) -> str | None:
    for k in ("url", "to", "email", "path", "query", "name"):
        if k in args:
            return str(args[k])[:200]
    return None


_TYPES = {
    "string": str, "integer": int, "number": (int, float), "boolean": bool,
    "array": list, "object": dict,
}


def validate_args(schema: dict[str, Any], args: dict[str, Any]) -> dict[str, Any]:
    """Minimal JSON-schema validation (types, required, enum, defaults).

    Unknown keys are dropped: the model must not smuggle extra parameters.
    """
    if not isinstance(args, dict):
        raise ToolError("Arguments must be an object", retryable=False)
    props: dict[str, Any] = schema.get("properties", {})
    out: dict[str, Any] = {}
    for key, spec in props.items():
        if key not in args or args[key] is None:
            if "default" in spec:
                out[key] = spec["default"]
            continue
        value = args[key]
        typ = spec.get("type")
        if typ == "integer" and isinstance(value, str) and value.strip().lstrip("-").isdigit():
            value = int(value)
        if typ == "number" and isinstance(value, str):
            try:
                value = float(value)
            except ValueError:
                pass
        if typ == "integer" and isinstance(value, float) and value.is_integer():
            value = int(value)
        expected = _TYPES.get(typ) if typ else None
        if expected and (not isinstance(value, expected) or (typ in ("integer", "number") and isinstance(value, bool))):
            raise ToolError(f"Argument '{key}' must be {typ}", retryable=False)
        if "enum" in spec and value not in spec["enum"]:
            raise ToolError(f"Argument '{key}' must be one of {spec['enum']}", retryable=False)
        if typ in ("integer", "number"):
            if "minimum" in spec and value < spec["minimum"]:
                value = spec["minimum"]
            if "maximum" in spec and value > spec["maximum"]:
                value = spec["maximum"]
        if typ == "string" and "maxLength" in spec:
            value = value[: spec["maxLength"]]
        out[key] = value
    for key in schema.get("required", []):
        if key not in out:
            raise ToolError(f"Missing required argument '{key}'", retryable=False)
    return out
