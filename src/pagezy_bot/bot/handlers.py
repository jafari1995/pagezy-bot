"""Telegram bot conversation handlers."""

from __future__ import annotations

import logging
import re
from datetime import datetime
from io import BytesIO

from telegram import Update
from telegram.ext import ContextTypes

from pagezy_bot.analysis.pipeline import run_report_pipeline
from pagezy_bot.analysis.stats import format_report_fa, summary_to_dict
from pagezy_bot.bot.auth import reject_if_not_allowed
from pagezy_bot.bot.keyboards import (
    export_picker,
    main_menu,
    platform_from_callback,
    platform_picker,
    time_range_picker,
)
from pagezy_bot.collectors.base import TimeRange, TimeRangeKind
from pagezy_bot.config import get_settings
from pagezy_bot.export.exporters import export_bytes
from pagezy_bot.llm.openrouter import OpenRouterClient
from pagezy_bot.scheduler.ad_monitor import format_alert_fa, scan_all_brands
from pagezy_bot.storage.db import get_user_state, session_scope, set_user_state
from pagezy_bot.storage.models import BrandScanChannel, MonitoredBrand, Platform

logger = logging.getLogger(__name__)

HELP_FA = """🤖 دستیار تحلیل Pagezy

منبع (تلگرام / اینستا / یوتیوب)، بازه زمانی، گزارش متنی و خروجی فایل.

• تلگرام: Telethon + سشن کاربر
• یوتیوب: YouTube Data API
• اینستاگرام: Instaloader یا Apify (ممکن است ناقص باشد)

/start و /menu"""


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await reject_if_not_allowed(update, context):
        return
    settings = get_settings()
    mode = "🧪 Mock" if settings.mock_mode else "Production"
    await update.message.reply_text(
        f"سلام حامد! تحلیلگر Pagezy آماده است ({mode}).\nمنو:",
        reply_markup=main_menu(),
    )


async def cmd_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await reject_if_not_allowed(update, context):
        return
    await update.message.reply_text("منوی اصلی:", reply_markup=main_menu())


async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await reject_if_not_allowed(update, context):
        return
    query = update.callback_query
    await query.answer()
    data = query.data or ""
    uid = update.effective_user.id

    if data == "menu":
        await query.edit_message_text("منوی اصلی:", reply_markup=main_menu())
        return
    if data == "help":
        await query.edit_message_text(HELP_FA)
        return

    if data == "competitor_analysis":
        with session_scope() as session:
            set_user_state(session, uid, "idle", {"awaiting": "conversational"})
        await query.edit_message_text(
            "عالی 👋 لینک یا @username تلگرام / اینستا / یوتیوب + بازه زمانی را یک پیام بفرستید.\n"
            "مثال: «کانال @foo هفته گذشته»",
        )
        return

    if data == "flow:report":
        with session_scope() as session:
            set_user_state(session, uid, "await_platform", {})
        await query.edit_message_text("پلتفرم:", reply_markup=platform_picker())
        return

    if data.startswith("platform:"):
        platform = platform_from_callback(data)
        with session_scope() as session:
            set_user_state(session, uid, "await_identifier", {"platform": platform.value})
        await query.edit_message_text(_platform_hint(platform))
        return

    if data.startswith("range:"):
        kind = TimeRangeKind(data.split(":")[1])
        with session_scope() as session:
            state = get_user_state(session, uid)
            d = dict(state.data_json)
        if kind == TimeRangeKind.CUSTOM:
            with session_scope() as session:
                set_user_state(session, uid, "await_custom_range", d)
            await query.edit_message_text("بازه: YYYY-MM-DD تا YYYY-MM-DD")
            return
        if "identifier" not in d:
            await query.edit_message_text("ابتدا منبع را وارد کنید.", reply_markup=main_menu())
            return
        await query.edit_message_text("⏳ در حال تحلیل…")
        await _finish_report(query, context, uid, d, TimeRange(kind))
        return

    if data.startswith("export:"):
        fmt = data.split(":")[1]
        summary = context.user_data.get("last_report")
        posts = context.user_data.get("last_posts")
        if not summary or not posts:
            await query.message.reply_text("گزارشی موجود نیست.", reply_markup=main_menu())
            return
        blob, filename, _mime = export_bytes(fmt, summary, posts)
        await query.message.reply_document(BytesIO(blob), filename=filename, caption=f"خروجی {fmt}")
        return

    if data == "flow:ask":
        with session_scope() as session:
            set_user_state(session, uid, "await_question", {})
        await query.edit_message_text("سوال خود را بپرسید:")
        return

    if data == "flow:brand":
        with session_scope() as session:
            set_user_state(session, uid, "await_brand_name", {})
        await query.edit_message_text("نام برند رقیب را بنویسید (مثال: چراغ):")
        return


async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await reject_if_not_allowed(update, context):
        return
    uid = update.effective_user.id
    text = (update.message.text or "").strip()

    with session_scope() as session:
        state = get_user_state(session, uid)
        flow, d = state.flow, dict(state.data_json)

    if flow == "await_identifier":
        d["identifier"] = text
        with session_scope() as session:
            set_user_state(session, uid, "await_range", d)
        await update.message.reply_text("بازه زمانی:", reply_markup=time_range_picker())
        return

    if flow == "await_custom_range":
        start, end = _parse_custom_range(text)
        if not start:
            await update.message.reply_text("فرمت نامعتبر.")
            return
        tr = TimeRange(TimeRangeKind.CUSTOM, start, end)
        await update.message.reply_text("⏳ در حال تحلیل…")
        await _finish_report_msg(update, context, uid, d, tr)
        return

    if flow == "await_question":
        summary = context.user_data.get("last_report_dict")
        if not summary:
            await update.message.reply_text("گزارشی موجود نیست.")
            return
        answer = await OpenRouterClient().answer_question(text, summary)
        with session_scope() as session:
            set_user_state(session, uid, "idle", {})
        await update.message.reply_text(answer)
        return

    if flow == "await_brand_name":
        d["brand_name"] = text
        with session_scope() as session:
            set_user_state(session, uid, "await_brand_keywords", d)
        await update.message.reply_text("کلمات کلیدی با ویرگول:")
        return

    if flow == "await_brand_keywords":
        keywords = [k.strip() for k in text.split(",") if k.strip()]
        keywords.append(d.get("brand_name", ""))
        with session_scope() as session:
            brand = MonitoredBrand(owner_user_id=uid, name=d.get("brand_name", ""), keywords_json=keywords)
            session.add(brand)
            session.flush()
            session.add(
                BrandScanChannel(
                    brand_id=brand.id,
                    platform=Platform.TELEGRAM,
                    identifier="pagezy_demo" if get_settings().mock_mode else "sample_channel",
                )
            )
            set_user_state(session, uid, "idle", {})
        await update.message.reply_text(f"برند «{d.get('brand_name')}» ثبت شد.")
        return

    await update.message.reply_text("از /menu استفاده کنید.", reply_markup=main_menu())


def _platform_hint(platform: Platform) -> str:
    return {
        Platform.TELEGRAM: "کانال تلگرام (@username یا لینک):",
        Platform.INSTAGRAM: "اینستاگرام (لینک یا username):",
        Platform.YOUTUBE: "لینک کانال یوتیوب:",
    }.get(platform, "شناسه منبع:")


def _parse_custom_range(text: str) -> tuple[datetime | None, datetime | None]:
    parts = re.split(r"\s*تا\s*|\s*-\s*", text)
    if not parts:
        return None, None
    try:
        start = datetime.fromisoformat(parts[0].strip())
        end = datetime.fromisoformat(parts[1].strip()) if len(parts) > 1 else None
        return start, end
    except ValueError:
        return None, None


async def _finish_report(query, context: ContextTypes.DEFAULT_TYPE, uid: int, d: dict, tr: TimeRange) -> None:
    platform = Platform(d["platform"])
    identifier = d["identifier"]
    try:
        summary, posts = await run_report_pipeline(uid, platform, identifier, tr)
    except Exception as e:
        logger.exception("report")
        await query.edit_message_text(f"خطا:\n{e}", reply_markup=main_menu())
        return
    context.user_data["last_report"] = summary
    context.user_data["last_posts"] = posts
    context.user_data["last_report_dict"] = summary_to_dict(summary)
    text = format_report_fa(summary, f"{platform.value} / {identifier}")
    await query.edit_message_text(text[:4000])
    await query.message.reply_text("دریافت فایل:", reply_markup=export_picker())
    with session_scope() as session:
        set_user_state(session, uid, "idle", d)


async def _finish_report_msg(update: Update, context: ContextTypes.DEFAULT_TYPE, uid: int, d: dict, tr: TimeRange) -> None:
    platform = Platform(d["platform"])
    identifier = d["identifier"]
    try:
        summary, posts = await run_report_pipeline(uid, platform, identifier, tr)
    except Exception as e:
        await update.message.reply_text(f"خطا:\n{e}", reply_markup=main_menu())
        return
    context.user_data["last_report"] = summary
    context.user_data["last_posts"] = posts
    context.user_data["last_report_dict"] = summary_to_dict(summary)
    await update.message.reply_text(
        format_report_fa(summary, f"{platform.value} / {identifier}")[:4000],
        reply_markup=export_picker(),
    )
    with session_scope() as session:
        set_user_state(session, uid, "idle", d)


async def notify_pending_alerts(context: ContextTypes.DEFAULT_TYPE) -> None:
    settings = get_settings()
    try:
        alerts = await scan_all_brands()
    except Exception as e:
        logger.warning("scan: %s", e)
        alerts = []

    if settings.mock_mode and not alerts:
        sample = (
            "🚨 نمونه هشدار (Mock)\nبرند: چراغ\nمنبع: telegram\n"
            "متن: تخفیف PAGEZY30 برای ابزار SEO چراغ — 3200 بازدید"
        )
        for chat_id in settings.allowed_user_ids:
            try:
                await context.bot.send_message(chat_id=chat_id, text=sample)
            except Exception:
                pass
        return

    with session_scope() as session:
        for alert in alerts:
            brand = session.get(MonitoredBrand, alert.brand_id)
            if not brand:
                continue
            text = format_alert_fa(alert, brand.name)
            try:
                await context.bot.send_message(chat_id=brand.owner_user_id, text=text[:4000])
                row = session.get(type(alert), alert.id)
                if row:
                    row.notified = True
            except Exception:
                pass