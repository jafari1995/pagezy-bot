"""Pluggable collectors per platform."""

from __future__ import annotations

from pagezy_bot.collectors.base import CollectedPost, TimeRange
from pagezy_bot.collectors.instagram import InstagramCollector
from pagezy_bot.collectors.telegram_mtproto import TelegramMTProtoCollector
from pagezy_bot.collectors.youtube import YouTubeCollector
from pagezy_bot.config import get_settings
from pagezy_bot.mock.fixtures import (
    mock_instagram_posts,
    mock_telegram_posts,
    mock_youtube_posts,
)
from pagezy_bot.storage.models import Platform


async def collect_posts(
    platform: Platform,
    identifier: str,
    time_range: TimeRange,
) -> list[CollectedPost]:
    settings = get_settings()
    start, end = time_range.resolve()

    if settings.mock_mode:
        if platform == Platform.TELEGRAM:
            posts = mock_telegram_posts(identifier.lstrip("@"))
        elif platform == Platform.INSTAGRAM:
            posts = mock_instagram_posts(identifier)
        else:
            posts = mock_youtube_posts(identifier)
        return [p for p in posts if p.in_range(start, end)]

    if platform == Platform.TELEGRAM:
        collector = TelegramMTProtoCollector()
        posts = await collector.fetch_channel_posts(identifier, limit=500)
    elif platform == Platform.INSTAGRAM:
        collector = InstagramCollector()
        posts = await collector.fetch_profile_posts(identifier, limit=100)
    elif platform == Platform.YOUTUBE:
        collector = YouTubeCollector()
        posts = await collector.fetch_channel_videos(identifier, limit=100)
    else:
        return []

    return [p for p in posts if p.in_range(start, end)]