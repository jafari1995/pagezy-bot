"""Owner-only access."""

from __future__ import annotations

from telegram import Update
from telegram.ext import ContextTypes

from pagezy_bot.config import get_settings


def is_allowed(user_id: int | None) -> bool:
    settings = get_settings()
    if settings.mock_mode and not settings.allowed_user_ids:
        return True
    if not user_id:
        return False
    if not settings.allowed_user_ids:
        return False
    return user_id in settings.allowed_user_ids


async def reject_if_not_allowed(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    uid = update.effective_user.id if update.effective_user else None
    if is_allowed(uid):
        return False
    msg = update.effective_message
    if msg:
        await msg.reply_text("⛔ دسترسی فقط برای مالک Pagezy فعال است. شناسه شما در ALLOWED_USER_IDS نیست.")
    return True