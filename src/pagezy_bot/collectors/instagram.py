"""Pluggable Instagram: Zarino (primary), Instaloader, optional Apify."""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

import httpx

from pagezy_bot.collectors.base import CollectedPost
from pagezy_bot.config import get_settings

logger = logging.getLogger(__name__)


class InstagramCollector:
    """Fetches public profile posts when possible."""

    async def fetch_profile_posts(self, link_or_username: str, limit: int = 50) -> list[CollectedPost]:
        settings = get_settings()
        username = _extract_username(link_or_username)

        if settings.zernio_api_key and settings.zernio_instagram_account_id:
            if link_or_username in (
                settings.zernio_instagram_account_id,
                "connected",
                "pagezy",
                "alsafaridev7",
                "@alsafaridev7",
            ):
                from pagezy_bot.collectors.zernio_instagram import fetch_connected_instagram

                return fetch_connected_instagram(settings.zernio_instagram_account_id, limit)

        if settings.zernio_api_key:
            from pagezy_bot.collectors.zernio_business_discovery import fetch_via_zernio_business_discovery

            try:
                return fetch_via_zernio_business_discovery(link_or_username, limit)
            except Exception as zerr:
                if settings.meta_ig_user_id and settings.meta_access_token:
                    from pagezy_bot.collectors.meta_business_discovery import fetch_via_meta_business_discovery

                    return fetch_via_meta_business_discovery(link_or_username, limit)
                raise zerr

        if settings.meta_ig_user_id and settings.meta_access_token:
            from pagezy_bot.collectors.meta_business_discovery import fetch_via_meta_business_discovery

            return fetch_via_meta_business_discovery(link_or_username, limit)

        if settings.apify_api_token:
            posts = await self._fetch_via_apify(username, limit)
            if posts:
                return posts
            logger.warning("Apify returned no data; falling back to Instaloader.")

        return self._fetch_via_instaloader(username, limit)

    def _fetch_via_instaloader(self, username: str, limit: int) -> list[CollectedPost]:
        settings = get_settings()
        try:
            import instaloader
        except ImportError:
            raise RuntimeError("instaloader نصب نیست.")

        loader = instaloader.Instaloader(
            download_pictures=False,
            download_videos=False,
            download_video_thumbnails=False,
            save_metadata=False,
            compress_json=False,
        )
        session_path = settings.instagram_session_path
        if session_path and Path(session_path).exists():
            try:
                loader.load_session_from_file(username, filename=session_path)
            except Exception as e:
                logger.warning("Instagram session load failed: %s", e)

        try:
            profile = instaloader.Profile.from_username(loader.context, username)
        except Exception as e:
            raise RuntimeError(
                f"دسترسی به اینستاگرام @{username} ممکن نشد (محدودیت یا لاگین). جزئیات: {e}"
            ) from e

        posts: list[CollectedPost] = []
        for post in profile.get_posts():
            if len(posts) >= limit:
                break
            fmt = "reel" if post.is_video and (post.video_duration or 0) < 90 else (
                "reel" if post.typename == "GraphVideo" else (
                    "carousel" if post.typename == "GraphSidecar" else "single_image"
                )
            )
            caption = post.caption or ""
            posts.append(
                CollectedPost(
                    external_id=str(post.mediaid),
                    published_at=post.date_utc.replace(tzinfo=None),
                    format_type=fmt,
                    caption=caption,
                    url=f"https://www.instagram.com/p/{post.shortcode}/",
                    likes=post.likes,
                    comments=post.comments,
                    views=post.video_view_count if post.is_video else None,
                    raw_meta={"typename": post.typename},
                )
            )
        if not posts:
            raise RuntimeError(
                f"پستی از @{username} دریافت نشد. احتمالاً نیاز به سشن لاگین یا Apify دارید."
            )
        return posts

    async def _fetch_via_apify(self, username: str, limit: int) -> list[CollectedPost]:
        settings = get_settings()
        actor = "apify/instagram-scraper"
        url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items"
        payload = {
            "usernames": [username],
            "resultsLimit": limit,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                url,
                params={"token": settings.apify_api_token},
                json=payload,
            )
            if resp.status_code != 200:
                logger.warning("Apify error %s: %s", resp.status_code, resp.text[:200])
                return []
            items = resp.json()
        posts: list[CollectedPost] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            caption = item.get("caption") or item.get("text") or ""
            ts = item.get("timestamp") or item.get("taken_at_timestamp")
            if ts:
                published = datetime.utcfromtimestamp(int(ts))
            else:
                published = datetime.utcnow()
            fmt = item.get("type", "post").lower()
            if "video" in fmt or item.get("isVideo"):
                fmt = "reel"
            elif item.get("childPosts") or item.get("images") and len(item.get("images", [])) > 1:
                fmt = "carousel"
            else:
                fmt = "single_image"
            posts.append(
                CollectedPost(
                    external_id=str(item.get("id") or item.get("shortCode") or len(posts)),
                    published_at=published,
                    format_type=fmt,
                    caption=caption,
                    url=item.get("url") or "",
                    likes=item.get("likesCount"),
                    comments=item.get("commentsCount"),
                    views=item.get("videoViewCount") or item.get("playCount"),
                )
            )
        return posts[:limit]


def _extract_username(value: str) -> str:
    value = value.strip().rstrip("/")
    if "instagram.com" in value:
        parts = value.split("/")
        for p in parts:
            if p and p not in ("https:", "http:", "www.instagram.com", "instagram.com"):
                return p.replace("@", "")
    return value.lstrip("@")