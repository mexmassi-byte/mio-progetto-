"""Delegation to Claude Code, with a fake `claude` executable."""

from __future__ import annotations

import os
import stat
import sys

import pytest

from jarvis.core.planner import heuristic_classification
from jarvis.departments.dev.claude_code import ALLOWED_TOOLS

FAKE = """#!{py}
import json, sys, pathlib
args = sys.argv[1:]
prompt = args[args.index("-p") + 1]
assert "--permission-mode" in args and args[args.index("--permission-mode") + 1] == "acceptEdits"
allowed = args[args.index("--allowedTools") + 1:]
assert not any("push" in a or "deploy" in a for a in allowed)
pathlib.Path("index.html").write_text("<!doctype html><h1>Studio Bianchi</h1>")
pathlib.Path("args.json").write_text(json.dumps(args))
print(json.dumps({{"type": "result", "is_error": False, "result": "Built index.html", "num_turns": 3,
                   "total_cost_usd": 0.12, "session_id": "s1"}}))
"""


@pytest.fixture
def fake_claude(tmp_path, services):
    exe = tmp_path / "claude"
    exe.write_text(FAKE.format(py=sys.executable))
    exe.chmod(exe.stat().st_mode | stat.S_IEXEC)
    services.settings.claude_code_binary = str(exe)
    services.planner.claude_binary = str(exe)
    return exe


def test_no_push_or_deploy_in_allowlist():
    joined = " ".join(ALLOWED_TOOLS)
    assert "push" not in joined and "deploy" not in joined and "rm" not in joined


def test_claude_requests_are_dev_projects():
    c = heuristic_classification("JARVIS, con Claude Code creami il sito per lo studio Bianchi a Genova")
    assert c["playbook"] == "dev_project"


async def test_mission_delegates_to_claude_code_after_approval(services, llm, fake_claude):
    llm.queue({"playbook": "dev_project", "project_name": "Studio Bianchi", "files": []})
    m = services.missions.create("Con Claude Code crea il sito per lo studio Bianchi a Genova")
    d = await services.engine.run_until_idle(m["id"])
    assert [t["tool"] for t in d["tasks"]] == ["dev_create_project", "dev_claude_code", "dev_list_files"]
    assert d["status"] == "awaiting_approval"  # uses the user's Claude account: asks first
    a = services.missions.approvals("pending")[0]
    await services.engine.decide(a["id"], True)
    d = await services.engine.run_until_idle(m["id"])
    assert d["status"] == "completed", [(t["tool"], t["status"], t["error"]) for t in d["tasks"]]
    assert services.workspaces.read("Studio Bianchi", "index.html").startswith("<!doctype html>")
    result = d["tasks"][1]["result"]
    assert result["summary"] == "Built index.html" and result["cost_usd"] == 0.12
    assert any(r["command"].startswith("claude") for r in services.workspaces.runs("Studio Bianchi"))


async def test_without_claude_installed_uses_local_model(services, llm):
    services.settings.claude_code_binary = "definitely-not-installed-claude"
    services.planner.claude_binary = "definitely-not-installed-claude"
    os.environ["PATH"] = os.environ.get("PATH", "")
    llm.queue({"playbook": "dev_project", "project_name": "Sito Rossi", "files": ["index.html"]},
              {"content": "<!doctype html><h1>Rossi</h1>"})
    m = services.missions.create("Con Claude Code crea il sito per Rossi")
    d = await services.engine.run_until_idle(m["id"])
    assert "dev_claude_code" not in [t["tool"] for t in d["tasks"]]
    assert d["status"] == "completed"
