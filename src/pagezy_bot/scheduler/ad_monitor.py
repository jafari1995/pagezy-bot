"""Periodic brand / ad mention scanning."""

from __future__ import annotations

import logging
import re
from datetime import datetime

from pagezy_bot.analysis.promo import detect_promotional
from pagezy_bot.collectors.base import TimeRange, TimeRangeKind
from pagezy_bot.collectors.factory import collect_posts
from pagezy_bot.config import get_settings
from pagezy_bot.storage.db import session_scope
from pagezy_bot.storage.models import AdAlert, BrandScanChannel, MonitoredBrand, Platform

logger = logging.getLogger(__name__)


def _matches_brand(text: str, name: str, keywords: list) -> bool:
    if not text:
        return False
    if name.lower() in text.lower():
        return True
    kws = keywords or []
    for kw in kws:
        if not kw:
            continue
        if kw.startswith("@"):
            if kw.lower() in text.lower():
                return True
        elif re.search(re.escape(kw), text, re.I):
            return True
    return False


async def scan_brand_ads(brand_id: int) -> list[AdAlert]:
    new_alerts: list[AdAlert] = []
    with session_scope() as session:
        brand = session.get(MonitoredBrand, brand_id)
        if not brand:
            return []
        channels = session.query(BrandScanChannel).filter_by(brand_id=brand_id).all()
        brand_name = brand.name
        keywords = list(brand.keywords_json or [])

    time_range = TimeRange(kind=TimeRangeKind.LAST_WEEK)

    for ch in channels:
        try:
            posts = await collect_posts(ch.platform, ch.identifier, time_range)
        except Exception as e:
            logger.warning("Scan failed %s %s: %s", ch.platform, ch.identifier, e)
            continue
        for p in posts:
            if not _matches_brand(p.caption, brand_name, keywords):
                continue
            with session_scope() as session:
                exists = (
                    session.query(AdAlert)
                    .filter_by(
                        brand_id=brand_id,
                        post_external_id=p.external_id,
                        source_identifier=ch.identifier,
                    )
                    .first()
                )
                if exists:
                    continue
                alert = AdAlert(
                    brand_id=brand_id,
                    source_platform=ch.platform,
                    source_identifier=ch.identifier,
                    post_external_id=p.external_id,
                    sample_text=p.caption[:4000],
                    published_at=p.published_at,
                    views=p.views,
                    notified=False,
                    raw_meta={"url": p.url},
                )
                session.add(alert)
                session.flush()
                new_alerts.append(alert)
    return new_alerts


async def scan_all_brands() -> list[AdAlert]:
    with session_scope() as session:
        brands = session.query(MonitoredBrand).all()
        ids = [b.id for b in brands]
    all_new: list[AdAlert] = []
    for bid in ids:
        all_new.extend(await scan_brand_ads(bid))
    return all_new


def format_alert_fa(alert: AdAlert, brand_name: str) -> str:
    return (
        f"🚨 هشدار تبلیغ/اشاره به «{brand_name}»\n"
        f"منبع: {alert.source_platform.value} — {alert.source_identifier}\n"
        f"تاریخ: {alert.published_at or alert.detected_at}\n"
        f"بازدید: {alert.views or '—'}\n\n"
        f"{alert.sample_text[:1500]}"
    )