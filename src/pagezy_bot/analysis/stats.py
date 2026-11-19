"""Report aggregation from classified posts."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from statistics import mean
from typing import Any


@dataclass
class PostForStats:
    published_at: datetime
    format_type: str
    topic_style: str
    views: int | None
    likes: int | None
    comments: int | None
    forwards: int | None
    is_promotional: bool
    caption: str = ""


@dataclass
class ReportSummary:
    total_posts: int = 0
    avg_per_day: float = 0.0
    avg_per_month: float = 0.0
    format_breakdown: dict[str, int] = field(default_factory=dict)
    topic_breakdown: dict[str, int] = field(default_factory=dict)
    format_topic_lines: list[str] = field(default_factory=list)
    stats_by_format: dict[str, dict[str, float | None]] = field(default_factory=dict)
    stats_by_topic: dict[str, dict[str, float | None]] = field(default_factory=dict)
    promo_count: int = 0
    regular_count: int = 0
    promo_stats: dict[str, float | None] = field(default_factory=dict)
    regular_stats: dict[str, float | None] = field(default_factory=dict)
    range_start: datetime | None = None
    range_end: datetime | None = None


def _avg(values: list[int]) -> float | None:
    return mean(values) if values else None


def _agg_metrics(posts: list[PostForStats]) -> dict[str, float | None]:
    views = [p.views for p in posts if p.views is not None]
    likes = [p.likes for p in posts if p.likes is not None]
    comments = [p.comments for p in posts if p.comments is not None]
    forwards = [p.forwards for p in posts if p.forwards is not None]
    return {
        "avg_views": _avg(views),
        "avg_likes": _avg(likes),
        "avg_comments": _avg(comments),
        "avg_forwards": _avg(forwards),
        "count": float(len(posts)),
    }


def build_report(posts: list[PostForStats]) -> ReportSummary:
    if not posts:
        return ReportSummary()

    posts_sorted = sorted(posts, key=lambda p: p.published_at)
    start, end = posts_sorted[0].published_at, posts_sorted[-1].published_at
    span_days = max((end - start).days + 1, 1)
    span_months = max(span_days / 30.0, 1 / 30)

    summary = ReportSummary(
        total_posts=len(posts),
        avg_per_day=len(posts) / span_days,
        avg_per_month=len(posts) / span_months,
        range_start=start,
        range_end=end,
    )

    for p in posts:
        summary.format_breakdown[p.format_type] = summary.format_breakdown.get(p.format_type, 0) + 1
        topic = p.topic_style or "نامشخص"
        summary.topic_breakdown[topic] = summary.topic_breakdown.get(topic, 0) + 1
        if p.is_promotional:
            summary.promo_count += 1
        else:
            summary.regular_count += 1

    # Narrative line per day estimate
    per_day = summary.avg_per_day
    ft_counts: dict[str, int] = defaultdict(int)
    for p in posts:
        key = f"{p.format_type} / {p.topic_style or 'نامشخص'}"
        ft_counts[key] += 1
    lines = []
    for key, cnt in sorted(ft_counts.items(), key=lambda x: -x[1])[:8]:
        est = (cnt / len(posts)) * per_day if posts else 0
        lines.append(f"~{est:.1f} در روز: {key}")
    summary.format_topic_lines = lines

    by_format: dict[str, list[PostForStats]] = defaultdict(list)
    by_topic: dict[str, list[PostForStats]] = defaultdict(list)
    promo_posts = [p for p in posts if p.is_promotional]
    regular_posts = [p for p in posts if not p.is_promotional]

    for p in posts:
        by_format[p.format_type].append(p)
        by_topic[p.topic_style or "نامشخص"].append(p)

    summary.stats_by_format = {k: _agg_metrics(v) for k, v in by_format.items()}
    summary.stats_by_topic = {k: _agg_metrics(v) for k, v in by_topic.items()}
    summary.promo_stats = _agg_metrics(promo_posts)
    summary.regular_stats = _agg_metrics(regular_posts)
    return summary


def format_report_fa(summary: ReportSummary, source_label: str) -> str:
    lines = [
        f"📊 گزارش Pagezy — {source_label}",
        "",
        f"تعداد پست در بازه: {summary.total_posts}",
        f"میانگین روزانه: {summary.avg_per_day:.2f}",
        f"میانگین ماهانه: {summary.avg_per_month:.1f}",
        "",
        "🧩 ترکیب فرمت و موضوع (تخمین روزانه):",
    ]
    lines.extend(f"• {line}" for line in summary.format_topic_lines)
    lines.extend(["", "📈 میانگین بازدید بر اساس فرمت:"])
    for fmt, st in summary.stats_by_format.items():
        av = st.get("avg_views")
        lines.append(f"• {fmt}: {int(av) if av else '—'} بازدید")
    lines.extend(
        [
            "",
            f"🎯 تبلیغی: {summary.promo_count} | عادی: {summary.regular_count}",
        ]
    )
    pv, rv = summary.promo_stats.get("avg_views"), summary.regular_stats.get("avg_views")
    lines.append(f"میانگین بازدید تبلیغی: {int(pv) if pv else '—'} | عادی: {int(rv) if rv else '—'}")
    return "\n".join(lines)


def summary_to_dict(summary: ReportSummary) -> dict[str, Any]:
    return {
        "total_posts": summary.total_posts,
        "avg_per_day": summary.avg_per_day,
        "avg_per_month": summary.avg_per_month,
        "format_breakdown": summary.format_breakdown,
        "topic_breakdown": summary.topic_breakdown,
        "format_topic_lines": summary.format_topic_lines,
        "stats_by_format": summary.stats_by_format,
        "stats_by_topic": summary.stats_by_topic,
        "promo_count": summary.promo_count,
        "regular_count": summary.regular_count,
        "promo_stats": summary.promo_stats,
        "regular_stats": summary.regular_stats,
        "range_start": summary.range_start.isoformat() if summary.range_start else None,
        "range_end": summary.range_end.isoformat() if summary.range_end else None,
    }