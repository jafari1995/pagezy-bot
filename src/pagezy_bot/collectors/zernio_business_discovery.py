"""Zernio GET /v1/accounts/{id}/instagram/business-discovery"""

from __future__ import annotations

import re
from datetime import datetime

import httpx

from pagezy_bot.collectors.base import CollectedPost
from pagezy_bot.config import get_settings
from pagezy_bot.collectors.meta_business_discovery import _map_format

ZERNIO_BASE = "https://zernio.com/api/v1"


def fetch_via_zernio_business_discovery(link_or_username: str, limit: int = 50) -> list[CollectedPost]:
    settings = get_settings()
    if not settings.zernio_api_key or not settings.zernio_instagram_account_id:
        raise RuntimeError("ZERNIO_API_KEY و ZERNIO_INSTAGRAM_ACCOUNT_ID لازم است.")
    username = link_or_username.strip().rstrip("/")
    m = re.search(r"instagram\.com/([^/?]+)", username, re.I)
    if m:
        username = m.group(1)
    username = username.lstrip("@")

    url = f"{ZERNIO_BASE}/accounts/{settings.zernio_instagram_account_id}/instagram/business-discovery"
    with httpx.Client(timeout=60.0) as client:
        resp = client.get(
            url,
            params={"username": username, "limit": limit},
            headers={"Authorization": f"Bearer {settings.zernio_api_key}"},
        )
    if resp.status_code != 200:
        raise RuntimeError(f"Zernio business-discovery: {resp.status_code} {resp.text[:200]}")
    data = resp.json()
    out: list[CollectedPost] = []
    for m in data.get("media") or []:
        out.append(
            CollectedPost(
                external_id=m["id"],
                published_at=datetime.fromisoformat(m["timestamp"].replace("Z", "+00:00")).replace(tzinfo=None),
                format_type=_map_format(m.get("mediaProductType"), m.get("mediaType")),
                caption=(m.get("caption") or "")[:4000],
                url=m.get("permalink") or "",
                views=m.get("viewCount"),
                likes=m.get("likeCount"),
                comments=m.get("commentsCount"),
                raw_meta={"source": "zernio_business_discovery"},
            )
        )
    return out