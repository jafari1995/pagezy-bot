"""Telegram public channel reader via Telethon MTProto."""

from __future__ import annotations

import logging
from datetime import datetime

from pagezy_bot.collectors.base import CollectedPost
from pagezy_bot.config import get_settings

logger = logging.getLogger(__name__)


def _detect_format(message) -> str:
    if message.voice:
        return "voice_note"
    if message.video_note:
        return "video_note"
    if message.video:
        return "video"
    if message.photo and message.text:
        return "image_text"
    if message.photo:
        return "image"
    if message.poll:
        return "poll"
    return "text_news"


class TelegramMTProtoCollector:
    async def fetch_channel_posts(self, identifier: str, limit: int = 200) -> list[CollectedPost]:
        settings = get_settings()
        if not settings.tg_api_id or not settings.tg_api_hash or not settings.tg_session_string:
            raise RuntimeError(
                "برای خواندن کانال تلگرام به TG_API_ID، TG_API_HASH و TG_SESSION_STRING نیاز است."
            )

        from telethon import TelegramClient
        from telethon.errors import FloodWaitError
        from telethon.sessions import StringSession

        client = TelegramClient(
            StringSession(settings.tg_session_string),
            settings.tg_api_id,
            settings.tg_api_hash,
        )
        posts: list[CollectedPost] = []
        await client.connect()
        if not await client.is_user_authorized():
            await client.disconnect()
            raise RuntimeError("سشن MTProto معتبر نیست. دوباره لاگین کنید.")

        try:
            entity = await client.get_entity(identifier)
            async for message in client.iter_messages(entity, limit=limit):
                if not message or not message.id:
                    continue
                text = message.text or message.message or ""
                views = getattr(message, "views", None)
                forwards = getattr(message, "forwards", None)
                reactions = None
                if getattr(message, "reactions", None) and message.reactions.results:
                    reactions = {}
                    for r in message.reactions.results:
                        emoticon = getattr(r.reaction, "emoticon", str(r.reaction))
                        reactions[emoticon] = r.count

                username = getattr(entity, "username", None) or identifier
                url = f"https://t.me/{username}/{message.id}"

                posts.append(
                    CollectedPost(
                        external_id=str(message.id),
                        published_at=message.date.replace(tzinfo=None) if message.date else datetime.utcnow(),
                        format_type=_detect_format(message),
                        caption=text,
                        url=url,
                        views=views,
                        forwards=forwards,
                        reactions=reactions,
                        raw_meta={"peer_id": str(getattr(entity, "id", ""))},
                    )
                )
        except FloodWaitError as e:
            logger.warning("FloodWait %s seconds", e.seconds)
            raise RuntimeError(f"محدودیت تلگرام (FloodWait): {e.seconds} ثانیه صبر کنید.") from e
        finally:
            await client.disconnect()

        return posts