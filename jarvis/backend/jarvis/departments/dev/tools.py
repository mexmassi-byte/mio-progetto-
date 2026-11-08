"""Development department tools."""

from __future__ import annotations

from ...llm.base import Message, extract_json
from ...prompts import POLICY
from ...tools.registry import ToolContext, ToolError, ToolRegistry
from .workspace import WorkspaceError


def _ws_call(fn, *args, **kw):
    try:
        return fn(*args, **kw)
    except WorkspaceError as exc:
        raise ToolError(str(exc), retryable=False) from exc


def register(reg: ToolRegistry) -> None:
    @reg.tool(
        "dev_create_project",
        "Create a new isolated project workspace (folder + README + git repository).",
        {"type": "object", "properties": {
            "name": {"type": "string", "maxLength": 80},
            "description": {"type": "string", "maxLength": 2000},
        }, "required": ["name"]},
        category="dev",
    )
    async def dev_create_project(ctx: ToolContext, name: str, description: str = "") -> dict:
        ws = ctx.services.workspaces
        p = _ws_call(ws.create, name, description)
        try:
            await ws.run(p["id"], ["git", "init"], timeout_s=30)
        except WorkspaceError:
            pass  # git is optional
        ctx.emit("dev.project_created", project_id=p["id"], name=name)
        return {"project_id": p["id"], "slug": p["slug"]}

    @reg.tool(
        "dev_list_files",
        "List the files of a project workspace.",
        {"type": "object", "properties": {"project": {"type": "string"}}, "required": ["project"]},
        category="dev",
    )
    async def dev_list_files(ctx: ToolContext, project: str) -> dict:
        return {"files": _ws_call(ctx.services.workspaces.files, project)}

    @reg.tool(
        "dev_read_file",
        "Read a file from a project workspace.",
        {"type": "object", "properties": {"project": {"type": "string"}, "path": {"type": "string"}},
         "required": ["project", "path"]},
        category="dev",
    )
    async def dev_read_file(ctx: ToolContext, project: str, path: str) -> dict:
        return {"path": path, "content": _ws_call(ctx.services.workspaces.read, project, path)}

    @reg.tool(
        "dev_write_file",
        "Write (create or replace) a file inside a project workspace.",
        {"type": "object", "properties": {
            "project": {"type": "string"}, "path": {"type": "string"},
            "content": {"type": "string", "maxLength": 500000},
        }, "required": ["project", "path", "content"]},
        category="dev",
    )
    async def dev_write_file(ctx: ToolContext, project: str, path: str, content: str) -> dict:
        res = _ws_call(ctx.services.workspaces.write, project, path, content)
        ctx.emit("dev.file_written", project=project, path=path)
        return res

    @reg.tool(
        "dev_generate_code",
        "Use the local model to write one source file from a specification, and save it in the project.",
        {"type": "object", "properties": {
            "project": {"type": "string"},
            "path": {"type": "string"},
            "specification": {"type": "string", "maxLength": 8000},
        }, "required": ["project", "path", "specification"]},
        category="dev", timeout_s=1200,
    )
    async def dev_generate_code(ctx: ToolContext, project: str, path: str, specification: str) -> dict:
        ws = ctx.services.workspaces
        files = _ws_call(ws.files, project)
        context = "\n".join(f["path"] for f in files[:80])
        existing = ""
        try:
            existing = ws.read(project, path)[:12000]
        except WorkspaceError:
            pass
        msgs = [
            Message("system", "You are the coding module of JARVIS. Write complete, working, "
                    "well-structured code for exactly one file. Return JSON {\"content\": \"...\", "
                    "\"notes\": \"...\"}. No placeholders like 'TODO: implement'.\n" + POLICY),
            Message("user", f"File: {path}\nSpecification:\n{specification}\n\nProject files:\n{context}\n\n"
                            f"Current content of the file (may be empty):\n{existing}"),
        ]
        result = await ctx.services.llm.chat(msgs, json_schema={
            "type": "object", "properties": {"content": {"type": "string"}, "notes": {"type": "string"}},
            "required": ["content"]})
        notes = None
        try:
            data = extract_json(result.text)
            content = str(data["content"])
            notes = data.get("notes")
        except Exception:
            content = result.text
        if not content.strip():
            raise ToolError("The model returned no code")
        res = _ws_call(ws.write, project, path, content)
        return {**res, "notes": notes, "verified": False, "hint": "run tests with dev_run to verify"}

    @reg.tool(
        "dev_run",
        "Run an allowlisted command in a project workspace (git status/diff/log/add/commit, npm "
        "install/test/run build, pytest...). Arguments as a list, no shell syntax.",
        {"type": "object", "properties": {
            "project": {"type": "string"},
            "argv": {"type": "array", "items": {"type": "string"}},
            "timeout_s": {"type": "integer", "default": 600, "minimum": 5, "maximum": 3600},
        }, "required": ["project", "argv"]},
        category="dev", timeout_s=3700,
    )
    async def dev_run(ctx: ToolContext, project: str, argv: list[str], timeout_s: int = 600) -> dict:
        try:
            res = await ctx.services.workspaces.run(project, argv, timeout_s=timeout_s)
        except WorkspaceError as exc:
            raise ToolError(str(exc), retryable=False) from exc
        ctx.emit("dev.command", project=project, command=res["command"], exit_code=res["exit_code"])
        return res
