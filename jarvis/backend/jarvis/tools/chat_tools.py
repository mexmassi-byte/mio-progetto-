"""Tools only available in conversation (never in automatic plans)."""

from __future__ import annotations

from ..security.permissions import Permission
from .registry import ToolContext, ToolError, ToolRegistry


def register(reg: ToolRegistry) -> None:
    @reg.tool(
        "create_mission",
        "Start an autonomous mission for a multi-step objective (research, finding customers, website "
        "audits, reports, development work). JARVIS plans and executes it in the background and "
        "notifies the user when done or when a decision is needed.",
        {"type": "object", "properties": {
            "objective": {"type": "string", "maxLength": 3000},
            "priority": {"type": "integer", "default": 5, "minimum": 1, "maximum": 10},
        }, "required": ["objective"]},
        category="missions", plannable=False,
    )
    async def create_mission(ctx: ToolContext, objective: str, priority: int = 5) -> dict:
        m = ctx.services.missions.create(objective, priority=priority)
        return {"mission_id": m["id"], "status": m["status"],
                "note": "Mission queued: the engine will plan and execute it."}

    @reg.tool(
        "mission_status",
        "Get the status and progress of missions (all active ones, or one by id).",
        {"type": "object", "properties": {"mission_id": {"type": "string"}}},
        category="missions", plannable=False,
    )
    async def mission_status(ctx: ToolContext, mission_id: str | None = None) -> dict:
        ms = ctx.services.missions
        if mission_id:
            m = ms.detail(mission_id)
            if not m:
                raise ToolError("Mission not found", retryable=False)
            return {"id": m["id"], "objective": m["objective"], "status": m["status"],
                    "progress": m["progress"], "error": m["error"], "verification": m["verification"],
                    "steps": [{"seq": t["seq"], "title": t["title"], "status": t["status"],
                               "error": t["error"]} for t in m["tasks"]]}
        return {"missions": [{"id": m["id"], "objective": m["objective"][:160], "status": m["status"],
                              "progress": m["progress"]["ratio"]} for m in ms.list(limit=15)],
                "pending_approvals": len(ms.approvals("pending"))}

    @reg.tool(
        "request_action",
        "Ask the user to approve an action that needs permission (e.g. sending an email draft). "
        "Creates an approval request; nothing happens until the user approves it.",
        {"type": "object", "properties": {
            "tool": {"type": "string"}, "args": {"type": "object"},
            "reason": {"type": "string", "maxLength": 500},
        }, "required": ["tool", "args", "reason"]},
        category="missions", plannable=False,
    )
    async def request_action(ctx: ToolContext, tool: str, args: dict, reason: str) -> dict:
        target = ctx.services.tools.get(tool)
        if target.permission is Permission.AUTONOMOUS:
            raise ToolError(f"'{tool}' does not need approval: call it directly", retryable=False)
        a = ctx.services.missions.request_approval(tool=tool, args=args, permission=target.permission.value,
                                                   reason=reason)
        return {"approval_id": a["id"], "status": "pending",
                "note": "Waiting for the user's decision in the Missions page."}
