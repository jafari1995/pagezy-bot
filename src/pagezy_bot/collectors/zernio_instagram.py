"""Zernio Analytics for connected Instagram accounts only."""

from __future__ import annotations

from datetime import datetime

import httpx

from pagezy_bot.collectors.base import CollectedPost
from pagezy_bot.config import get_settings

ZERNIO_BASE = "https://zernio.com/api/v1"


def fetch_connected_instagram(account_id: str, limit: int = 50) -> list[CollectedPost]:
    settings = get_settings()
    if not settings.zernio_api_key:
        raise RuntimeError("ZERNIO_API_KEY تنظیم نشده.")
    url = f"{ZERNIO_BASE}/analytics"
    with httpx.Client(timeout=60.0) as client:
        resp = client.get(
            url,
            params={"accountId": account_id, "platform": "instagram", "limit": limit, "page": 1},
            headers={"Authorization": f"Bearer {settings.zernio_api_key}"},
        )
    if resp.status_code != 200:
        raise RuntimeError(f"Zernio analytics: {resp.status_code} {resp.text[:200]}")
    data = resp.json()
    posts = data.get("posts") or []
    out: list[CollectedPost] = []
    for p in posts:
        pid = p.get("postId")
        if not pid:
            continue
        analytics = p.get("analytics") or {}
        out.append(
            CollectedPost(
                external_id=str(pid),
                published_at=datetime.fromisoformat(p.get("publishedAt", datetime.utcnow().isoformat()).replace("Z", "+00:00")).replace(tzinfo=None),
                format_type="reel" if "reel" in str(p.get("mediaType", "")).lower() else "single_image",
                caption=(p.get("content") or "")[:4000],
                url=p.get("platformPostUrl") or "",
                views=analytics.get("views"),
                likes=analytics.get("likes"),
                comments=analytics.get("comments"),
                raw_meta={"source": "zernio_connected"},
            )
        )
    return out