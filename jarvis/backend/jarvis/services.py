"""Service container: builds and wires every component once."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from .config import Settings
from .db.database import Database
from .events import EventBus
from .llm.base import LLMProvider
from .llm.factory import build_provider
from .memory.knowledge import KnowledgeBase
from .memory.store import MemoryStore
from .security.audit import AuditLog
from .security.auth import load_or_create_token
from .tools.registry import ToolRegistry

if TYPE_CHECKING:  # pragma: no cover
    from .chat import ChatService
    from .core.engine import Engine
    from .core.goals import GoalService
    from .core.missions import MissionService
    from .core.planner import Planner
    from .departments.dev.workspace import Workspaces
    from .departments.sales.crm import CRM


@dataclass
class Services:
    settings: Settings
    db: Database
    bus: EventBus
    audit: AuditLog
    llm: LLMProvider
    memory: MemoryStore
    knowledge: KnowledgeBase
    tools: ToolRegistry
    token: str
    missions: "MissionService" = None  # type: ignore[assignment]
    planner: "Planner" = None  # type: ignore[assignment]
    engine: "Engine" = None  # type: ignore[assignment]
    crm: "CRM" = None  # type: ignore[assignment]
    workspaces: "Workspaces" = None  # type: ignore[assignment]
    chat: "ChatService" = None  # type: ignore[assignment]
    goals: "GoalService" = None  # type: ignore[assignment]
    vault: Any = None
    channels: Any = None
    voice: Any = None

    def set_llm(self, llm: LLMProvider) -> None:
        """Swap the model at runtime (settings page) without restarting."""
        self.llm = llm
        self.memory.llm = llm
        self.planner.llm = llm


def build_services(settings: Settings, llm: LLMProvider | None = None) -> Services:
    from .chat import ChatService
    from .core.engine import Engine
    from .core.goals import GoalService
    from .core.missions import MissionService
    from .core.planner import Planner
    from .departments.dev import tools as dev_tools
    from .departments.dev.workspace import Workspaces
    from .departments.sales import tools as sales_tools
    from .departments.sales.crm import CRM
    from .tools import builtin, chat_tools, web

    settings.ensure_dirs()
    db = Database(settings.db_path)
    db.migrate()
    bus = EventBus(db)
    llm = llm or build_provider(settings)
    _apply_saved_model(db, settings, llm)
    knowledge = KnowledgeBase(settings.knowledge_dir)
    knowledge.ensure_defaults()
    tools = ToolRegistry()
    for module in (builtin, web, sales_tools, dev_tools, chat_tools):
        module.register(tools)
    from .integrations import tools as integration_tools
    integration_tools.register(tools)
    if settings.google_autonomous_writes:  # the owner chose: calendar/tasks/docs without asking each time
        from .security.permissions import Permission as _P
        for name in integration_tools.GOOGLE_WRITE_TOOLS:
            tools.get(name).permission = _P.AUTONOMOUS
    if settings.claude_code_autonomous:  # the user chose to let JARVIS use Claude Code freely
        from .security.permissions import Permission
        tools.get("dev_claude_code").permission = Permission.AUTONOMOUS
    s = Services(
        settings=settings, db=db, bus=bus, audit=AuditLog(db), llm=llm,
        memory=MemoryStore(db, bus, llm), knowledge=knowledge, tools=tools,
        token=load_or_create_token(settings.token_path),
    )
    s.missions = MissionService(db, bus, settings)
    s.planner = Planner(llm, tools)
    s.planner.claude_binary = settings.claude_code_binary
    s.crm = CRM(db, bus)
    s.workspaces = Workspaces(settings.workspaces_dir, db)
    s.engine = Engine(s)
    s.chat = ChatService(s)
    s.goals = GoalService(s)
    from .integrations.vault import Vault
    s.vault = Vault(db, settings.data_dir, use_keyring=settings.llm_provider != "fake")
    from .voice.engine import VoiceEngine
    s.voice = VoiceEngine(settings, db, s.audit)
    from .integrations.channels import Channels
    s.channels = Channels(s)
    return s


def _apply_saved_model(db: Database, settings: Settings, llm: LLMProvider) -> None:
    from .db.database import loads

    row = db.one("SELECT value FROM settings WHERE key = 'llm_model'")
    if row:
        model = loads(row["value"])
        if isinstance(model, str) and model:
            llm.model = model
            settings.llm_model = model
