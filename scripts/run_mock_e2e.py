#!/usr/bin/env python3
"""End-to-end mock flow without Telegram network."""

from __future__ import annotations

import asyncio
import os
from datetime import datetime
from pathlib import Path

# Ensure mock mode
os.environ.setdefault("MOCK_MODE", "true")
os.environ.setdefault("DATABASE_URL", "sqlite:///./data/mock-e2e.db")
os.environ.setdefault("ALLOWED_USER_IDS", "1")

from pagezy_bot.analysis.pipeline import run_report_pipeline
from pagezy_bot.analysis.stats import format_report_fa
from pagezy_bot.collectors.base import TimeRange, TimeRangeKind
from pagezy_bot.config import assert_model_is_free, get_settings
from pagezy_bot.export.exporters import export_csv, export_pdf, export_xlsx
from pagezy_bot.llm.openrouter import OpenRouterClient
from pagezy_bot.mock.fixtures import mock_telegram_posts
from pagezy_bot.scheduler.ad_monitor import _matches_brand
from pagezy_bot.storage.db import init_db
from pagezy_bot.storage.models import Platform


async def main() -> None:
    init_db()
    settings = get_settings()
    assert settings.mock_mode

    for model in settings.free_model_list():
        assert_model_is_free(model)
    try:
        assert_model_is_free("openai/gpt-4o")
    except ValueError:
        pass
    else:
        raise AssertionError("Paid model should be rejected")

    owner = 1
    summary, posts = await run_report_pipeline(
        owner,
        Platform.TELEGRAM,
        "@pagezy_demo",
        TimeRange(TimeRangeKind.LAST_WEEK),
    )
    report = format_report_fa(summary, "telegram/@pagezy_demo")
    print("--- Report ---")
    print(report)

    out = Path("exports")
    export_xlsx(summary, posts, out / "mock.xlsx")
    export_csv(summary, posts, out / "mock.csv")
    export_pdf(summary, posts, out / "mock.pdf")
    print("Exports:", list(out.glob("mock.*")))

    ans = await OpenRouterClient().answer_question(
        "کدام نوع محتوا بیشترین بازدید را داشت؟",
        {"stats_by_format": summary.stats_by_format},
    )
    print("LLM mock answer:", ans)

    assert _matches_brand(mock_telegram_posts("x")[3].caption, "چراغ", ["چراغ", "PAGEZY"])
    print("Ad keyword match: OK")
    print("Mock E2E OK at", datetime.utcnow().isoformat())


if __name__ == "__main__":
    asyncio.run(main())