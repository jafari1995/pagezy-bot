"""Application configuration from environment."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Persian tone / brand voice — single place for LLM system prompt
PAGEZY_SYSTEM_PROMPT_FA = """تو دستیار تحلیل محتوای برند Pagezy هستی.
مالک: حامد جعفری. لحن: صمیمی، روشن، مدرن و حرفه‌ای — فارسی روان.
گزارش‌ها باید قابل‌فهم، خلاصه ولی دقیق باشند؛ از اصطلاحات پیچیده بی‌مورد پرهیز کن.
اعداد را با جداکننده هزارگان فارسی یا لاتین یکدست بنویس.
وقتی داده ناقص است، صریح بگو چه چیزی در دسترس نبود."""

DEFAULT_FREE_MODELS = [
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia/nemotron-3.5-lightning:free",
    "baidu/ernie-5.5-flash-preview:free",
    "inclusionai/ling-3.2-flash:free",
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    telegram_bot_token: str = ""
    allowed_user_ids: list[int] = Field(default_factory=list)

    tg_api_id: int | None = None
    tg_api_hash: str = ""
    tg_session_string: str = ""

    openrouter_api_key: str = ""
    openrouter_model: str = ""

    youtube_api_key: str = ""

    zernio_api_key: str = ""
    zernio_instagram_account_id: str = ""
    meta_ig_user_id: str = ""
    meta_access_token: str = ""
    meta_graph_version: str = "v22.0"
    instagram_session_path: str = ""
    apify_api_token: str = ""

    database_url: str = "sqlite:///./data/pagezy.db"
    mock_mode: bool = False
    ad_scan_interval_minutes: int = 120
    cache_ttl_hours: int = 6
    log_level: str = "INFO"

    project_root: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[2])
    font_path: Path | None = None

    @field_validator("allowed_user_ids", mode="before")
    @classmethod
    def parse_allowed_ids(cls, v: str | list[int]) -> list[int]:
        if isinstance(v, list):
            return v
        if not v or not str(v).strip():
            return []
        return [int(x.strip()) for x in str(v).split(",") if x.strip()]

    @field_validator("mock_mode", mode="before")
    @classmethod
    def parse_bool(cls, v: object) -> bool:
        if isinstance(v, bool):
            return v
        return str(v).lower() in ("1", "true", "yes", "on")

    def resolved_font_path(self) -> Path:
        if self.font_path and self.font_path.exists():
            return self.font_path
        default = self.project_root / "fonts" / "Vazirmatn-Regular.ttf"
        return default

    def free_model_list(self) -> list[str]:
        models = list(DEFAULT_FREE_MODELS)
        if self.openrouter_model:
            assert_model_is_free(self.openrouter_model)
            if self.openrouter_model not in models:
                models.insert(0, self.openrouter_model)
        return models


def assert_model_is_free(model_id: str) -> None:
    """Reject paid OpenRouter models."""
    if not model_id.endswith(":free"):
        raise ValueError(
            f"Model '{model_id}' is not allowed. Only OpenRouter models ending with ':free' are permitted."
        )


def get_settings() -> Settings:
    return Settings()