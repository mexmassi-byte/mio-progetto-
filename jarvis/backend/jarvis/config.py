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
    # Keep the model in memory between messages (Ollama unloads it after 5
    # minutes by default, and reloading costs seconds on every first message).
    llm_keep_alive: str = "2h"

    # User identity used in prompts.
    user_name: str = "Massimiliano"
    # How JARVIS addresses the founders, per language (not by first name).
    title_it: str = "Signore"
    title_en: str = "Sir"
    title_de: str = "Master"
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
    # Speech synthesis: "elevenlabs" (cloud, best quality, needs an API key)
    # with automatic fallback to "piper" (local). "piper" = local only.
    tts_provider: str = "piper"
    elevenlabs_api_key: str | None = None
    elevenlabs_voice_id: str = "nPczCjzI2devNBz1zQrb"  # "Brian": deep, resonant, male
    elevenlabs_model: str = "eleven_multilingual_v2"   # same voice in IT / DE / EN
    elevenlabs_base_url: str = "https://api.elevenlabs.io"
    # Characters JARVIS may send per calendar month (free plan: 10,000).
    # Beyond this it switches to the local voice instead of failing.
    elevenlabs_monthly_chars: int = 10000
    whisper_model: str = "small"
    piper_binary: str = "piper"
    piper_voice: str | None = None  # path to a .onnx voice model

    # Optional Claude Code delegation for development work (uses the Claude
    # account logged in on this computer). Approval required unless autonomous.
    claude_code_binary: str = "claude"
    claude_code_autonomous: bool = False
    claude_code_timeout_s: int = 1800

    # ---------------------------------------------------------- integrations
    # Secrets (tokens, keys) are stored encrypted in the vault (Settings page);
    # the values below are only non-secret configuration. The same names in
    # the environment / .env also work and take precedence over the vault.
    owner_phone_numbers: list[str] = []      # E.164 without '+', e.g. ["393331234567"]
    owner_emails: list[str] = []

    # WhatsApp Cloud API (official Meta platform). JARVIS has its own number;
    # the owners' numbers are the only ones allowed to give it orders.
    whatsapp_phone_number_id: str | None = None
    whatsapp_access_token: str | None = None
    whatsapp_app_secret: str | None = None
    whatsapp_verify_token: str | None = None
    whatsapp_api_version: str = "v23.0"
    whatsapp_graph_url: str = "https://graph.facebook.com"
    whatsapp_notify_template: str | None = None   # approved template for messages outside 24 h
    whatsapp_template_language: str = "it"

    # Public webhook server (only /webhooks/*), for a tunnel such as cloudflared.
    webhook_host: str = "127.0.0.1"
    webhook_port: int = 8766

    # Google (OAuth 2.0, desktop client)
    google_client_id: str | None = None
    google_client_secret: str | None = None
    email_reports: bool = True               # daily report copy to the founders' own Gmail
    google_autonomous_writes: bool = False   # calendar/tasks/docs without asking each time

    # Phone calls (Twilio). Off until the owner enables them explicitly.
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from_number: str | None = None
    twilio_api_url: str = "https://api.twilio.com"
    phone_calls_enabled: bool = False
    phone_max_calls_per_day: int = 3
    phone_quiet_hours: str = "23-7"          # no calls in this range except critical events
    phone_min_payment_eur: float = 500.0     # payments below this do not trigger a call

    # Always-on wake phrases (local microphone, nothing leaves the computer).
    wake_enabled: bool = False
    wake_sensitivity: float = 0.6            # 0..1, higher = easier to trigger
    wake_whisper_model: str = "tiny"          # always listening (light)
    wake_confirm_model: str = "small"         # checks only likely activations (accurate)

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
