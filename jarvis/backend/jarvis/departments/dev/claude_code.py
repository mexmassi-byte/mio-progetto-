"""Optional delegation of development work to Claude Code (the `claude` CLI).

JARVIS works without it. When it is installed and logged in on the computer,
JARVIS can hand a coding job to it, confined to one project workspace:
headless mode (`claude -p`), edits accepted automatically inside that folder,
and only an allowlist of shell commands (install, build, test, local git).
Pushing, deploying and publishing are not in the allowlist.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import time
from pathlib import Path
from typing import Any

ALLOWED_TOOLS = [
    "Read", "Write", "Edit", "Glob", "Grep",
    "Bash(npm install)", "Bash(npm ci)", "Bash(npm run build)", "Bash(npm run lint)", "Bash(npm test)",
    "Bash(npx tsc --noEmit)", "Bash(python -m pytest:*)", "Bash(python3 -m pytest:*)",
    "Bash(git status)", "Bash(git diff:*)", "Bash(git add:*)", "Bash(git commit:*)", "Bash(git log:*)",
    "Bash(ls:*)",
]

PREFACE = """You are working for JARVIS, the AI operating system of {company}, inside this project folder:
{path}
Rules: work ONLY inside this folder. Do not push, deploy, publish or contact anyone. Do not
install global software. Prefer simple, maintainable, production-quality code; responsive design;
accessible HTML. When you finish, reply with a short summary: what you built, the files, and how to
run or preview it.

PROJECT README:
{readme}

TASK:
{task}
"""


def find_claude(name: str = "claude") -> str | None:
    found = shutil.which(name)
    if found:
        return found
    home = Path.home()
    for candidate in (home / ".claude" / "local" / "claude", Path("/opt/homebrew/bin/claude"),
                      Path("/usr/local/bin/claude"), home / ".npm-global" / "bin" / "claude"):
        if candidate.exists():
            return str(candidate)
    return None


async def run_claude_code(binary: str, workdir: Path, task: str, company: str,
                          timeout_s: int = 1800) -> dict[str, Any]:
    readme = ""
    readme_path = workdir / "README.md"
    if readme_path.exists():
        readme = readme_path.read_text(encoding="utf-8", errors="replace")[:3000]
    prompt = PREFACE.format(company=company, path=str(workdir), readme=readme or "(none)", task=task[:8000])
    argv = [binary, "-p", prompt, "--output-format", "json", "--permission-mode", "acceptEdits",
            "--allowedTools", *ALLOWED_TOOLS]
    env = {k: v for k, v in os.environ.items()
           if k in ("PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "TMPDIR", "USERPROFILE", "APPDATA",
                    "LOCALAPPDATA", "SYSTEMROOT", "ANTHROPIC_API_KEY", "CLAUDE_CONFIG_DIR")}
    t0 = time.perf_counter()
    proc = await asyncio.create_subprocess_exec(*argv, cwd=str(workdir), env=env,
                                                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                                                stdin=asyncio.subprocess.DEVNULL)
    try:
        out, err = await asyncio.wait_for(proc.communicate(), timeout=timeout_s)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return {"ok": False, "error": f"Claude Code timed out after {timeout_s}s"}
    seconds = round(time.perf_counter() - t0, 1)
    text = out.decode(errors="replace").strip()
    try:
        data = json.loads(text.splitlines()[-1] if text else "{}")
    except ValueError:
        data = {"result": text}
    ok = proc.returncode == 0 and not data.get("is_error")
    return {
        "ok": ok,
        "summary": str(data.get("result") or "")[:6000],
        "error": None if ok else (str(data.get("result") or err.decode(errors="replace"))[:1500] or
                                  f"exit code {proc.returncode}"),
        "cost_usd": data.get("total_cost_usd"),
        "turns": data.get("num_turns"),
        "session_id": data.get("session_id"),
        "seconds": seconds,
    }
