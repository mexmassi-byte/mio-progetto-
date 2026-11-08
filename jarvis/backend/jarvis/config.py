"""Runtime configuration.

Every value can be overridden with an environment variable prefixed with
``JARVIS_`` (for example ``JARVIS_LLM_MODEL=qwen3:14b``) or in a ``.env``
file next to the backend.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = BACKEND_DIR.parent / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="JARVIS_", env_file=".env", extra="ignore")

    # Network: local-only by default.
    host: str = "127.0.0.1"
    port: int = 8765
    allowed_origins: list[str] = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8765",
        "http://localhost:8765",
    ]

    data_dir: Path = DEFAULT_DATA_DIR

    # AI provider. "ollama" (default), "openai" (any OpenAI-compatible local
    # server such as LM Studio or llama.cpp) or "fake" (tests / no model).
    llm_provider: str = "ollama"
    llm_base_url: str = "http://127.0.0.1:11434"
    llm_model: str = "qwen3:8b"
    llm_embed_model: str = "nomic-embed-text"
    llm_timeout_s: float = 300.0
    llm_temperature: float = 0.3
    llm_context_tokens: int = 8192
    # Hidden "thinking" of reasoning models (qwen3, deepseek-r1...). Off by
    # default: measured 7x faster answers on CPU. None = model default.
    llm_think: bool | None = False
    # Hard cap on generated tokens per answer: a degenerate model that loops
    # must not generate forever (seen with very small models).
    llm_max_tokens: int = 1500

    # User identity used in prompts.
    user_name: str = "Massimiliano"
    company_name: str = "VEYRO Web"
    language: str = "it"

    # Autonomous engine.
    engine_enabled: bool = True
    engine_tick_s: float = 2.0
    engine_max_parallel_missions: int = 1
    default_mission_max_steps: int = 40
    default_mission_max_seconds: int = 3 * 3600
    default_task_timeout_s: int = 600
    default_task_max_attempts: int = 3

    # Research.
    searxng_url: str = "http://127.0.0.1:8888"
    overpass_url: str = "https://overpass-api.de/api/interpreter"
    # Tried in order when the main server is down or rate-limited.
    overpass_fallback_urls: list[str] = [
        "https://overpass.kumi.systems/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ]
    http_user_agent: str = "JARVIS-VeyroWeb/0.1 (local business research assistant)"
    http_timeout_s: float = 20.0

    # Outbound email (disabled unless configured; always needs approval).
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None

    # Voice.
    whisper_model: str = "small"
    piper_binary: str = "piper"
    piper_voice: str | None = None  # path to a .onnx voice model

    backup_keep: int = 14

    @property
    def db_path(self) -> Path:
        return self.data_dir / "jarvis.db"

    @property
    def knowledge_dir(self) -> Path:
        return self.data_dir / "knowledge"

    @property
    def workspaces_dir(self) -> Path:
        return self.data_dir / "workspaces"

    @property
    def backups_dir(self) -> Path:
        return self.data_dir / "backups"

    @property
    def logs_dir(self) -> Path:
        return self.data_dir / "logs"

    @property
    def token_path(self) -> Path:
        return self.data_dir / "auth-token"

    def ensure_dirs(self) -> None:
        for d in (self.data_dir, self.knowledge_dir, self.workspaces_dir, self.backups_dir, self.logs_dir):
            d.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
