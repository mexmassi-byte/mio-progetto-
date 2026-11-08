"""Planner: objective -> ordered steps.

Small local models are unreliable at long free-form plans, so the planner
works in two layers:
1. Classification into a known *playbook* (lead acquisition, website audit)
   whose steps are fixed, tested code. The model only extracts parameters.
2. Free-form planning for anything else, with strict validation: every step
   must name an existing, plannable tool with schema-valid arguments. Invalid
   plans are sent back to the model once with the errors, then rejected.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from ..llm.base import LLMError, LLMProvider, Message
from ..prompts import CLASSIFIER_PROMPT, PLANNER_PROMPT
from ..security.permissions import Permission
from ..tools.registry import ToolError, ToolRegistry, validate_args
from . import playbooks


class PlanningError(Exception):
    pass


@dataclass
class Plan:
    kind: str
    params: dict[str, Any]
    steps: list[dict[str, Any]]
    completion_condition: str
    notes: list[str] = field(default_factory=list)


CLASSIFY_SCHEMA = {
    "type": "object",
    "properties": {
        "playbook": {"type": "string", "enum": ["lead_acquisition", "website_audit", "dev_project", "freeform"]},
        "project_name": {"type": ["string", "null"]},
        "files": {"type": "array", "items": {"type": "string"}},
        "sector": {"type": ["string", "null"]},
        "country": {"type": ["string", "null"]},
        "city": {"type": ["string", "null"]},
        "count": {"type": ["integer", "null"]},
        "urls": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["playbook"],
}

PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "steps": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "tool": {"type": "string"},
                "args": {"type": "object"},
                "optional": {"type": "boolean"},
            },
            "required": ["title", "tool", "args"],
        }},
        "completion_condition": {"type": "string"},
    },
    "required": ["steps", "completion_condition"],
}


class Planner:
    def __init__(self, llm: LLMProvider, tools: ToolRegistry):
        self.llm = llm
        self.tools = tools

    async def plan(self, objective: str, kind: str = "auto", params: dict[str, Any] | None = None) -> Plan:
        params = dict(params or {})
        notes: list[str] = []
        if kind == "auto":
            cls = await self.classify(objective)
            kind = cls.pop("playbook")
            notes.append(f"classified as {kind}")
            params = {**{k: v for k, v in cls.items() if v not in (None, [], "")}, **params}

        if kind == "lead_acquisition":
            steps, cond = playbooks.lead_acquisition(params)
        elif kind == "website_audit":
            steps, cond = playbooks.website_audit(params)
        elif kind == "dev_project":
            steps, cond = playbooks.dev_project(params, objective)
        elif kind == "freeform":
            steps, cond = await self.freeform(objective, notes)
        else:
            raise PlanningError(f"Unknown mission kind: {kind}")
        for s in steps:  # playbook steps are validated too, as a safety net
            self._check_step(s)
        return Plan(kind=kind, params=params, steps=steps, completion_condition=cond, notes=notes)

    async def classify(self, objective: str) -> dict[str, Any]:
        try:
            data = await self.llm.chat_json(
                [Message("system", CLASSIFIER_PROMPT), Message("user", objective)], CLASSIFY_SCHEMA)
            if isinstance(data, dict) and data.get("playbook") in ("lead_acquisition", "website_audit", "dev_project", "freeform"):
                return _normalize_classification(data, objective)
        except LLMError:
            pass
        return heuristic_classification(objective)

    async def freeform(self, objective: str, notes: list[str]) -> tuple[list[dict], str]:
        catalog = "\n".join(
            f"tool: {t.name}\n  does: {t.description}\n  args: {_compact_args(t.parameters)}"
            for t in self.tools.all() if t.plannable and t.permission is not Permission.EXPLICIT
        )
        msgs = [
            Message("system", PLANNER_PROMPT + "\nTOOL CATALOG\n" + catalog),
            Message("user", f"Objective: {objective}"),
        ]
        last_errors: list[str] = []
        for attempt in range(2):
            data: Any = None
            try:
                data = await self.llm.chat_json(msgs, PLAN_SCHEMA)
            except LLMError as exc:
                last_errors = [str(exc)]
                continue
            steps = data.get("steps") if isinstance(data, dict) else None
            if not isinstance(steps, list) or not steps:
                last_errors = ["the plan has no steps"]
            else:
                errors = []
                clean = []
                for i, s in enumerate(steps[:12], start=1):
                    try:
                        clean.append(self._check_step({
                            "title": str(s.get("title") or s.get("tool")), "tool": s.get("tool"),
                            "args": s.get("args") or {}, "optional": bool(s.get("optional")),
                            "depends_on": [i - 1] if i > 1 else [],
                        }))
                    except (PlanningError, ToolError) as exc:
                        errors.append(f"step {i}: {exc}")
                if not errors:
                    cond = str(data.get("completion_condition") or "All planned steps succeed.")
                    notes.append(f"free-form plan accepted on attempt {attempt + 1}")
                    return clean, cond
                last_errors = errors
            msgs.append(Message("assistant", str(data)[:3000]))
            msgs.append(Message("user", "The plan is invalid:\n- " + "\n- ".join(last_errors)
                                + "\nReturn a corrected plan."))
        raise PlanningError("Could not produce a valid plan: " + "; ".join(last_errors))

    def _check_step(self, step: dict[str, Any]) -> dict[str, Any]:
        name = step.get("tool")
        if isinstance(name, str) and not self.tools.has(name):
            # Small models sometimes decorate names ("memory_search [autonomous]").
            m = re.match(r"\s*`?([a-z][a-z0-9_]*)", name)
            if m and self.tools.has(m.group(1)):
                name = step["tool"] = m.group(1)
        if not isinstance(name, str) or not self.tools.has(name):
            raise PlanningError(f"unknown tool '{name}'")
        tool = self.tools.get(name)
        if not tool.plannable or tool.permission is Permission.EXPLICIT:
            raise PlanningError(f"tool '{name}' cannot be used in automatic plans")
        step["args"] = validate_args(tool.parameters, step.get("args") or {})
        return step


def _compact_args(schema: dict[str, Any]) -> str:
    """'query: string (required), limit: integer' — shorter than raw JSON schema."""
    req = set(schema.get("required", []))
    parts = []
    for key, spec in schema.get("properties", {}).items():
        typ = spec.get("type", "any")
        if "enum" in spec:
            typ = "one of " + "|".join(map(str, spec["enum"][:12]))
        parts.append(f"{key}: {typ}{' (required)' if key in req else ''}")
    return ", ".join(parts) or "none"


_COUNTRY_WORDS = {
    "DE": ("germania", "germany", "deutschland", "tedesc", "german"),
    "IT": ("italia", "italy", "italien", "italian"),
    "AT": ("austria", "österreich", "osterreich"),
    "CH": ("svizzera", "schweiz", "switzerland"),
}
_SECTOR_WORDS = {
    "lawyer": ("avvocat", "legal", "lawyer", "anwalt", "kanzlei", "rechtsanw"),
    "dentist": ("dentist", "zahnarzt", "odontoiatr"),
    "clinic": ("clinic", "klinik", "clinica", "praxis", "medic"),
    "aesthetic": ("estetic", "aesthetic", "kosmetik", "beauty", "ästhetik"),
    "tax_advisor": ("commercialist", "steuerberat", "tax advis", "fiscal"),
    "physiotherapist": ("fisioterap", "physiotherap"),
    "architect": ("architett", "architekt", "architect"),
    "notary": ("notai", "notar", "notary"),
}
_NUMBER_WORDS = {"un": 1, "uno": 1, "due": 2, "tre": 3, "quattro": 4, "cinque": 5, "sei": 6, "sette": 7,
                 "otto": 8, "nove": 9, "dieci": 10, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
                 "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "fünf": 5, "zehn": 10}
_LEAD_WORDS = ("client", "prospect", "lead", "kunde", "customer", "contatt", "acquisi")
_DEV_CREATE = ("crea", "create", "scrivi", "write", "sviluppa", "build", "costruisci", "genera", "erstelle")
_DEV_OBJECT = ("progetto", "project", "sito", "website", "app", "pagina", "page", "codice", "code", "file")
_FILE_RE = re.compile(r"\b[\w/-]+\.(?:html|css|js|ts|tsx|jsx|py|md|json)\b", re.I)
_NAME_RE = re.compile(r"(?:chiamato|chiamata|called|named|nome)\s+[\"'“]?([\w][\w .-]{1,60}?)[\"'”]?(?:\s+(?:e|and|con|with)\b|[,.:;]|$)", re.I)


def _find_city(text: str) -> str | None:
    """Known city (or alias such as 'Monaco', 'Colonia', 'Munich') named in the text."""
    from ..departments.sales.geo import ALIASES, CITIES

    low = text.lower()
    for name in sorted(list(CITIES) + list(ALIASES), key=len, reverse=True):
        if re.search(rf"\b{re.escape(name.lower())}\b", low):
            return ALIASES.get(name.lower(), name) if name not in CITIES else name
    return None


def heuristic_classification(objective: str) -> dict[str, Any]:
    text = objective.lower()
    urls = re.findall(r"https?://[^\s,;]+|\b[\w-]+\.(?:de|it|com|at|ch|eu|net|org)\b[^\s,;]*", objective)
    country = next((c for c, words in _COUNTRY_WORDS.items() if any(w in text for w in words)), None)
    sector = next((s for s, words in _SECTOR_WORDS.items() if any(w in text for w in words)), None)
    count = None
    m = re.search(r"\b(\d{1,3})\b", text)
    if m:
        count = int(m.group(1))
    else:
        for w, n in _NUMBER_WORDS.items():
            if re.search(rf"\b{w}\b", text):
                count = n
                break
    files = _FILE_RE.findall(objective)
    if (any(w in text for w in _DEV_CREATE) and any(w in text for w in _DEV_OBJECT)
            and (files or "progett" in text or "project" in text) and not any(w in text for w in _LEAD_WORDS)):
        m = _NAME_RE.search(objective)
        return {"playbook": "dev_project", "project_name": m.group(1).strip() if m else None, "files": files,
                "sector": None, "country": None, "city": None, "count": None, "urls": []}
    if any(w in text for w in _LEAD_WORDS) or (sector and count):
        city = _find_city(objective)
        if city and not country:
            country = next((c for c, cities in playbooks.DEFAULT_CITIES.items() if city in cities), None)
        return {"playbook": "lead_acquisition", "sector": sector, "country": country, "city": city,
                "count": count, "urls": []}
    if urls and any(w in text for w in ("analizz", "audit", "analy", "controlla", "check", "prüf")):
        return {"playbook": "website_audit", "urls": urls, "sector": None, "country": None,
                "city": None, "count": None}
    return {"playbook": "freeform", "sector": None, "country": None, "city": None, "count": None, "urls": []}


def _normalize_classification(data: dict[str, Any], objective: str) -> dict[str, Any]:
    out = {
        "playbook": data.get("playbook"),
        "sector": data.get("sector") if data.get("sector") in playbooks.SECTORS else None,
        "country": (data.get("country") or "").upper()[:2] or None,
        "city": data.get("city") or None,
        "count": data.get("count") if isinstance(data.get("count"), int) else None,
        "urls": [u for u in data.get("urls") or [] if isinstance(u, str)][:20],
        "project_name": data.get("project_name") or None,
        "files": [f for f in data.get("files") or [] if isinstance(f, str)][:8],
    }
    # Fill gaps with the deterministic parser (cheap and verifiable).
    h = heuristic_classification(objective)
    for k in ("sector", "country", "count", "city"):
        if out.get(k) is None and h.get(k) is not None:
            out[k] = h[k]
    if out["playbook"] == "website_audit" and not out["urls"]:
        out["urls"] = h.get("urls") or []
    if h.get("playbook") == "dev_project" and out["playbook"] == "freeform":
        out["playbook"] = "dev_project"  # deterministic signal beats a vague model answer
    if out["playbook"] == "dev_project":
        out["project_name"] = out["project_name"] or h.get("project_name")
        out["files"] = out["files"] or h.get("files") or []
    return out
