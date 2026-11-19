"""Meta Graph API Business Discovery for competitor Instagram accounts."""

from __future__ import annotations

import re
from datetime import datetime
from urllib.parse import quote

import httpx

from pagezy_bot.collectors.base import CollectedPost
from pagezy_bot.config import get_settings

GRAPH_VERSION = "v22.0"


def _map_format(media_product_type: str | None, media_type: str | None) -> str:
    product = (media_product_type or "").upper()
    mt = (media_type or "").upper()
    if product in ("REELS", "REEL"):
        return "reel"
    if mt == "CAROUSEL_ALBUM" or product == "CAROUSEL_ALBUM":
        return "carousel"
    if mt == "VIDEO":
        return "video"
    return "single_image"


def fetch_via_meta_business_discovery(link_or_username: str, limit: int = 50) -> list[CollectedPost]:
    settings = get_settings()
    if not settings.meta_ig_user_id or not settings.meta_access_token:
        raise RuntimeError("META_IG_USER_ID و META_ACCESS_TOKEN برای Business Discovery لازم است.")

    username = _extract_username(link_or_username).lower()
    version = settings.meta_graph_version or GRAPH_VERSION
    posts: list[CollectedPost] = []
    after: str | None = None

    while len(posts) < limit:
        batch = min(25, limit - len(posts))
        fields = _build_fields(username, batch, after)
        url = (
            f"https://graph.facebook.com/{version}/{settings.meta_ig_user_id}"
            f"?fields={quote(fields)}&access_token={quote(settings.meta_access_token)}"
        )
        with httpx.Client(timeout=60.0) as client:
            resp = client.get(url)
        data = resp.json()
        if not resp.ok:
            raise RuntimeError(data.get("error", {}).get("message", resp.text[:200]))

        bd = data.get("business_discovery") or {}
        media = (bd.get("media") or {}).get("data") or []
        if not media:
            break
        for m in media:
            posts.append(
                CollectedPost(
                    external_id=m["id"],
                    published_at=datetime.fromisoformat(m["timestamp"].replace("Z", "+00:00")).replace(tzinfo=None),
                    format_type=_map_format(m.get("media_product_type"), m.get("media_type")),
                    caption=(m.get("caption") or "")[:4000],
                    url=m.get("permalink") or "",
                    views=None,
                    likes=m.get("like_count"),
                    comments=m.get("comments_count"),
                    raw_meta={"source": "meta_business_discovery"},
                )
            )
        after = (bd.get("media") or {}).get("paging", {}).get("cursors", {}).get("after")
        if not after:
            break

    if not posts:
        raise RuntimeError(f"@{username}: Business Discovery نتیجه‌ای نداد.")
    return posts


def _build_fields(username: str, limit: int, after: str | None) -> str:
    inner = "id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink"
    media = f"media.after({after}).limit({limit}){{{inner}}}" if after else f"media.limit({limit}){{{inner}}}"
    return f"business_discovery.username({username}){{username,followers_count,media_count,{media}}}"


def _extract_username(value: str) -> str:
    value = value.strip().rstrip("/")
    if "instagram.com" in value:
        m = re.search(r"instagram\.com/([^/?]+)", value, re.I)
        if m:
            return m.group(1).replace("@", "")
    return value.lstrip("@")