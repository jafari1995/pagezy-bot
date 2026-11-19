"""Fetch, classify, persist posts and build reports."""

from __future__ import annotations

from datetime import datetime, timedelta

from pagezy_bot.analysis.promo import detect_promotional
from pagezy_bot.analysis.stats import PostForStats, ReportSummary, build_report
from pagezy_bot.collectors.base import CollectedPost, TimeRange
from pagezy_bot.collectors.factory import collect_posts
from pagezy_bot.config import get_settings
from pagezy_bot.llm.openrouter import OpenRouterClient
from pagezy_bot.storage.db import session_scope
from pagezy_bot.storage.models import Platform, PostRecord, TrackedSource


async def run_report_pipeline(
    owner_id: int,
    platform: Platform,
    identifier: str,
    time_range: TimeRange,
) -> tuple[ReportSummary, list[PostForStats]]:
    settings = get_settings()
    cache_key = f"{platform.value}:{identifier}:{time_range.kind.value}"

    with session_scope() as session:
        source = (
            session.query(TrackedSource)
            .filter_by(owner_user_id=owner_id, platform=platform, identifier=identifier)
            .first()
        )
        if not source:
            source = TrackedSource(
                owner_user_id=owner_id,
                platform=platform,
                identifier=identifier,
                display_name=identifier,
            )
            session.add(source)
            session.flush()

        use_cache = (
            source.last_fetched_at
            and datetime.utcnow() - source.last_fetched_at < timedelta(hours=settings.cache_ttl_hours)
            and not settings.mock_mode
        )
        if use_cache:
            db_posts = session.query(PostRecord).filter_by(source_id=source.id).all()
            collected = [_record_to_collected(p) for p in db_posts]
            start, end = time_range.resolve()
            collected = [p for p in collected if p.in_range(start, end)]
        else:
            collected = await collect_posts(platform, identifier, time_range)
            await _upsert_posts(session, source.id, collected, platform)
            source.last_fetched_at = datetime.utcnow()

    enriched = await enrich_posts(collected)
    summary = build_report(enriched)
    return summary, enriched


def _record_to_collected(p: PostRecord) -> CollectedPost:
    return CollectedPost(
        external_id=p.external_id,
        published_at=p.published_at,
        format_type=p.format_type,
        caption=p.caption,
        url=p.url,
        views=p.views,
        likes=p.likes,
        comments=p.comments,
        forwards=p.forwards,
        reactions=p.reactions,
        raw_meta=p.raw_meta or {},
    )


async def _upsert_posts(session, source_id: int, posts: list[CollectedPost], platform: Platform) -> None:
    llm = OpenRouterClient()
    promos = [detect_promotional(p.caption) for p in posts]
    batch_items = [{"id": p.external_id, "caption": p.caption[:800]} for p in posts]
    topics = await llm.classify_posts_batch(batch_items)

    for p, (is_promo, reason), topic in zip(posts, promos, topics, strict=True):
        existing = (
            session.query(PostRecord)
            .filter_by(source_id=source_id, external_id=p.external_id, platform=platform)
            .first()
        )
        if existing:
            existing.views = p.views
            existing.likes = p.likes
            existing.comments = p.comments
            existing.forwards = p.forwards
            existing.topic_style = topic
            existing.is_promotional = is_promo
            existing.promo_reason = reason
            continue
        session.add(
            PostRecord(
                platform=platform,
                source_id=source_id,
                external_id=p.external_id,
                published_at=p.published_at,
                format_type=p.format_type,
                caption=p.caption,
                url=p.url,
                views=p.views,
                likes=p.likes,
                comments=p.comments,
                forwards=p.forwards,
                reactions=p.reactions,
                raw_meta=p.raw_meta,
                topic_style=topic,
                is_promotional=is_promo,
                promo_reason=reason,
            )
        )


async def enrich_posts(posts: list[CollectedPost]) -> list[PostForStats]:
    if not posts:
        return []
    llm = OpenRouterClient()
    promos = [detect_promotional(p.caption) for p in posts]
    topics = await llm.classify_posts_batch(
        [{"id": p.external_id, "caption": p.caption[:800]} for p in posts]
    )
    out: list[PostForStats] = []
    for p, (is_promo, _), topic in zip(posts, promos, topics, strict=True):
        out.append(
            PostForStats(
                published_at=p.published_at,
                format_type=p.format_type,
                topic_style=topic,
                views=p.views,
                likes=p.likes,
                comments=p.comments,
                forwards=p.forwards,
                is_promotional=is_promo,
                caption=p.caption,
            )
        )
    return out