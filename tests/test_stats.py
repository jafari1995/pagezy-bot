from datetime import datetime, timedelta

from pagezy_bot.analysis.stats import PostForStats, build_report


def test_build_report_averages():
    base = datetime(2025, 1, 10)
    posts = [
        PostForStats(base, "text", "خبری", 100, 10, 2, 1, False),
        PostForStats(base + timedelta(days=5), "video", "آموزشی", 200, 20, 4, 2, False),
        PostForStats(base + timedelta(days=9), "image_text", "تبلیغ", 50, 5, 0, 0, True),
    ]
    r = build_report(posts)
    assert r.total_posts == 3
    assert r.promo_count == 1
    assert r.regular_count == 2
    assert r.avg_per_day > 0