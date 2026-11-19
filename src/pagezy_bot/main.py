"""Entry point for Pagezy analyst bot."""

from __future__ import annotations

import logging
import sys

from telegram.ext import Application, CallbackQueryHandler, CommandHandler, MessageHandler, filters

from pagezy_bot.bot.handlers import (
    cmd_menu,
    cmd_start,
    notify_pending_alerts,
    on_callback,
    on_text,
)
from pagezy_bot.config import get_settings
from pagezy_bot.storage.db import init_db


def main() -> None:
    settings = get_settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    init_db()

    if not settings.telegram_bot_token and not settings.mock_mode:
        print("TELEGRAM_BOT_TOKEN is required (or set MOCK_MODE=true for local tests).", file=sys.stderr)
        sys.exit(1)

    token = settings.telegram_bot_token or "0000000000:MOCK_TOKEN_FOR_TESTS_ONLY"

    app = (
        Application.builder()
        .token(token)
        .build()
    )

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("menu", cmd_menu))
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))

    if app.job_queue:
        interval = max(settings.ad_scan_interval_minutes, 5) * 60
        app.job_queue.run_repeating(notify_pending_alerts, interval=interval, first=30)

    if settings.mock_mode and token.startswith("0"):
        logging.getLogger(__name__).info("Mock mode without valid token — run scripts/run_mock_e2e.py instead.")
        return

    app.run_polling(allowed_updates=["message", "callback_query"])


if __name__ == "__main__":
    main()