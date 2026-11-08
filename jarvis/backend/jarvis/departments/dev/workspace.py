"""Isolated project workspaces under ``data/workspaces/<slug>``.

JARVIS can only read and write inside a workspace, and can only run commands
from an allowlist (no shell, no pipes, no arbitrary programs). This keeps it
away from unrelated files and production projects.
"""

from __future__ import annotations

import asyncio
import os
import re
import shutil
import time
from pathlib import Path
from typing import Any

from ...db.database import Database, new_id, now_iso

SLUG_RE = re.compile(r"[^a-z0-9]+")
MAX_FILE_BYTES = 1_000_000
IGNORED_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".next"}

# argv prefixes JARVIS may run inside a workspace.
ALLOWED_COMMANDS: list[list[str]] = [
    ["git", "status"], ["git", "log"], ["git", "diff"], ["git", "add"], ["git", "commit"],
    ["git", "init"], ["git", "branch"], ["git", "checkout", "-b"], ["git", "show"],
    ["npm", "install"], ["npm", "ci"], ["npm", "test"], ["npm", "run", "build"], ["npm", "run", "lint"],
    ["npm", "run", "test"], ["npx", "tsc"], ["node", "--version"],
    ["python", "-m", "pytest"], ["python3", "-m", "pytest"], ["pytest"],
    ["python", "-m", "py_compile"], ["python3", "-m", "py_compile"],
]
FORBIDDEN_ARGS = ("--global", "-g", "push", "--force", "reset", "clean", "rm", "remote")


class WorkspaceError(Exception):
    pass


def slugify(name: str) -> str:
    slug = SLUG_RE.sub("-", name.lower()).strip("-")[:60]
    if not slug:
        raise WorkspaceError("Invalid project name")
    return slug


class Workspaces:
    def __init__(self, root: Path, db: Database):
        self.root = root
        self.db = db
        root.mkdir(parents=True, exist_ok=True)

    def create(self, name: str, description: str = "") -> dict[str, Any]:
        slug = slugify(name)
        if self.db.one("SELECT id FROM projects WHERE slug = ?", (slug,)):
            raise WorkspaceError(f"Project '{slug}' already exists")
        path = self.root / slug
        path.mkdir(parents=True, exist_ok=False)
        pid = new_id("prj")
        ts = now_iso()
        self.db.insert("projects", {"id": pid, "name": name, "slug": slug, "description": description,
                                    "created_at": ts, "updated_at": ts})
        (path / "README.md").write_text(f"# {name}\n\n{description}\n", encoding="utf-8")
        return self.get(pid)  # type: ignore[return-value]

    def get(self, project_id: str) -> dict[str, Any] | None:
        row = self.db.one("SELECT * FROM projects WHERE id = ? OR slug = ?", (project_id, project_id))
        if row:
            row["path"] = str(self.root / row["slug"])
        return row

    def list(self) -> list[dict[str, Any]]:
        rows = self.db.query("SELECT * FROM projects ORDER BY updated_at DESC")
        for r in rows:
            r["path"] = str(self.root / r["slug"])
        return rows

    def path_of(self, project_id: str) -> Path:
        p = self.get(project_id)
        if not p:
            raise WorkspaceError(f"Unknown project {project_id}")
        return Path(p["path"])

    def safe_path(self, project_id: str, rel: str) -> Path:
        base = self.path_of(project_id).resolve()
        target = (base / rel).resolve()
        if target != base and base not in target.parents:
            raise WorkspaceError("Path outside the project workspace")
        if any(part == ".git" for part in target.relative_to(base).parts):
            raise WorkspaceError("Direct access to .git is not allowed")
        return target

    def files(self, project_id: str, limit: int = 500) -> list[dict[str, Any]]:
        base = self.path_of(project_id)
        out = []
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS]
            for f in filenames:
                p = Path(dirpath) / f
                out.append({"path": str(p.relative_to(base)).replace("\\", "/"), "size": p.stat().st_size})
                if len(out) >= limit:
                    return out
        return sorted(out, key=lambda x: x["path"])

    def read(self, project_id: str, rel: str) -> str:
        p = self.safe_path(project_id, rel)
        if not p.is_file():
            raise WorkspaceError(f"File not found: {rel}")
        if p.stat().st_size > MAX_FILE_BYTES:
            raise WorkspaceError("File too large")
        return p.read_text(encoding="utf-8", errors="replace")

    def write(self, project_id: str, rel: str, content: str) -> dict[str, Any]:
        if len(content.encode()) > MAX_FILE_BYTES:
            raise WorkspaceError("Content too large")
        p = self.safe_path(project_id, rel)
        p.parent.mkdir(parents=True, exist_ok=True)
        existed = p.exists()
        p.write_text(content, encoding="utf-8")
        self.db.update("projects", "id", self.get(project_id)["id"], {"updated_at": now_iso()})  # type: ignore[index]
        return {"path": rel, "bytes": len(content.encode()), "created": not existed}

    def delete_project(self, project_id: str) -> None:
        p = self.get(project_id)
        if not p:
            raise WorkspaceError("Unknown project")
        shutil.rmtree(p["path"], ignore_errors=True)
        self.db.execute("DELETE FROM projects WHERE id = ?", (p["id"],))

    async def run(self, project_id: str, argv: list[str], timeout_s: int = 600) -> dict[str, Any]:
        check_command(argv)
        cwd = self.path_of(project_id)
        exe = shutil.which(argv[0])
        if not exe:
            raise WorkspaceError(f"Program not installed: {argv[0]}")
        env = {k: v for k, v in os.environ.items()
               if k in ("PATH", "HOME", "USERPROFILE", "SYSTEMROOT", "TEMP", "TMP", "LANG", "APPDATA",
                        "LOCALAPPDATA", "PROGRAMFILES", "COMSPEC", "PATHEXT")}
        env.update({"GIT_TERMINAL_PROMPT": "0", "CI": "1", "GIT_AUTHOR_NAME": "JARVIS",
                    "GIT_AUTHOR_EMAIL": "jarvis@localhost", "GIT_COMMITTER_NAME": "JARVIS",
                    "GIT_COMMITTER_EMAIL": "jarvis@localhost"})
        t0 = time.perf_counter()
        proc = await asyncio.create_subprocess_exec(exe, *argv[1:], cwd=str(cwd), env=env,
                                                    stdout=asyncio.subprocess.PIPE,
                                                    stderr=asyncio.subprocess.STDOUT,
                                                    stdin=asyncio.subprocess.DEVNULL)
        try:
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout_s)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            out, code = b"(timeout)", -1
        else:
            code = proc.returncode
        ms = int((time.perf_counter() - t0) * 1000)
        text = out.decode(errors="replace")
        if len(text) > 20000:
            text = text[:8000] + "\n…(output truncated)…\n" + text[-8000:]
        project = self.get(project_id)
        self.db.insert("command_runs", {"project_id": project["id"] if project else None,
                                        "command": " ".join(argv), "exit_code": code, "output": text,
                                        "duration_ms": ms, "ts": now_iso()})
        return {"command": " ".join(argv), "exit_code": code, "output": text, "duration_ms": ms}

    def runs(self, project_id: str, limit: int = 30) -> list[dict]:
        p = self.get(project_id)
        if not p:
            return []
        return self.db.query("SELECT * FROM command_runs WHERE project_id = ? ORDER BY id DESC LIMIT ?",
                             (p["id"], limit))


def check_command(argv: list[str]) -> None:
    if not argv or not all(isinstance(a, str) and a for a in argv):
        raise WorkspaceError("Empty command")
    if any(ch in a for a in argv for ch in (";", "|", "&", "`", "$(", ">", "<", "\n")):
        raise WorkspaceError("Shell syntax is not allowed")
    if any(a in FORBIDDEN_ARGS for a in argv[1:]):
        raise WorkspaceError(f"Argument not allowed: {argv}")
    if any(a.startswith("/") or ".." in a or (len(a) > 1 and a[1] == ":") for a in argv[1:]):
        raise WorkspaceError("Paths outside the workspace are not allowed")
    for prefix in ALLOWED_COMMANDS:
        if argv[: len(prefix)] == prefix:
            return
    raise WorkspaceError(f"Command not in the allowlist: {' '.join(argv)}")
