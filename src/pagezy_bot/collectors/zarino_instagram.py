"""Zarino API — primary Instagram provider (pluggable)."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import httpx

from pagezy_bot.collectors.base import CollectedPost
from pagezy_bot.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_POSTS_PATH = "/v1/instagram/profile/posts"


def fetch_via_zarino(link_or_username: str, limit: int = 50) -> list[CollectedPost]:
    settings = get_settings()
    if not settings.zarino_api_key:
        raise RuntimeError("ZARINO_API_KEY تنظیم نشده.")
    if not settings.zarino_api_base_url:
        raise RuntimeError("ZARINO_API_BASE_URL تنظیم نشده — URL پایه API Zarino را از تیم Pagezy بگیرید.")

    username = _extract_username(link_or_username)
    url = f"{settings.zarino_api_base_url.rstrip('/')}{DEFAULT_POSTS_PATH}"
    with httpx.Client(timeout=60.0) as client:
        resp = client.get(
            url,
            params={"username": username, "limit": limit},
            headers={"Authorization": f"Bearer {settings.zarino_api_key}", "Accept": "application/json"},
        )
    if resp.status_code in (401, 403):
        raise RuntimeError("کلید Zarino نامعتبر است.")
    if resp.status_code != 200:
        raise RuntimeError(f"Zarino HTTP {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    raw = _extract_posts(data)
    posts = [_map_post(item) for item in raw[:limit]]
    return [p for p in posts if p is not None]


def _extract_posts(data: dict[str, Any]) -> list[dict[str, Any]]:
    if isinstance(data.get("posts"), list):
        return data["posts"]
    inner = data.get("data") or {}
    if isinstance(inner.get("posts"), list):
        return inner["posts"]
    if isinstance(data.get("items"), list):
        return data["items"]
    return []


def _map_post(item: dict[str, Any]) -> CollectedPost | None:
    eid = str(item.get("id") or item.get("post_id") or "")
    if not eid:
        return None
    caption = str(item.get("caption") or item.get("text") or "")
    published = item.get("published_at") or item.get("timestamp") or datetime.utcnow().isoformat()
    type_name = str(item.get("type") or "post").lower()
    if "reel" in type_name or "video" in type_name:
        fmt = "reel"
    elif "carousel" in type_name:
        fmt = "carousel"
    else:
        fmt = "single_image"
    return CollectedPost(
        external_id=eid,
        published_at=datetime.fromisoformat(str(published).replace("Z", "+00:00")).replace(tzinfo=None),
        format_type=fmt,
        caption=caption,
        url=str(item.get("url") or item.get("permalink") or ""),
        views=item.get("views") or item.get("play_count"),
        likes=item.get("likes") or item.get("like_count"),
        comments=item.get("comments") or item.get("comment_count"),
        raw_meta=item,
    )


def _extract_username(value: str) -> str:
    value = value.strip().rstrip("/")
    if "instagram.com" in value:
        for part in value.split("/"):
            if part and "instagram.com" not in part and part not in ("https:", "http:", "www.instagram.com"):
                return part.replace("@", "")
    return value.lstrip("@")