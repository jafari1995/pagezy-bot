"""Deterministic mock posts for demo mode and tests."""

from __future__ import annotations

from datetime import datetime, timedelta

from pagezy_bot.collectors.base import CollectedPost


def mock_telegram_posts(channel: str) -> list[CollectedPost]:
    base = datetime.utcnow()
    return [
        CollectedPost(
            external_id="tg-1001",
            published_at=base - timedelta(days=2, hours=3),
            format_type="voice_note",
            caption="آموزش سریع: چطور با ربات تلگرام فروش بیشتری داشته باشیم.",
            url=f"https://t.me/{channel}/1001",
            views=12400,
            forwards=89,
            reactions={"👍": 120, "🔥": 45},
        ),
        CollectedPost(
            external_id="tg-1002",
            published_at=base - timedelta(days=2, hours=8),
            format_type="image_text",
            caption="کاور + متن: معرفی ابزار Pagezy — لینک ربات @pagezy_bot",
            url=f"https://t.me/{channel}/1002",
            views=8900,
            forwards=12,
            reactions={"❤": 30},
        ),
        CollectedPost(
            external_id="tg-1003",
            published_at=base - timedelta(days=1, hours=5),
            format_type="text_news",
            caption="تحلیل خبر: الگوریتم جدید اینستاگرام و تاثیرش روی ریلز.",
            url=f"https://t.me/{channel}/1003",
            views=15200,
            forwards=210,
        ),
        CollectedPost(
            external_id="tg-1004",
            published_at=base - timedelta(hours=10),
            format_type="image_text",
            caption="تبلیغ همکاری: تخفیف ۳۰٪ کد PAGEZY30 برای ابزار SEO چراغ",
            url=f"https://t.me/{channel}/1004",
            views=3200,
            forwards=4,
        ),
        CollectedPost(
            external_id="tg-1005",
            published_at=base - timedelta(days=5),
            format_type="video",
            caption="ویدیو آموزشی: ساخت کانال محتوایی در یک هفته",
            url=f"https://t.me/{channel}/1005",
            views=22000,
            forwards=55,
        ),
    ]


def mock_instagram_posts(username: str) -> list[CollectedPost]:
    base = datetime.utcnow()
    return [
        CollectedPost(
            external_id="ig-1",
            published_at=base - timedelta(days=3),
            format_type="reel",
            caption="ریلز آموزشی: سه اشتباه رایج در کپشن‌نویسی",
            url=f"https://instagram.com/p/mock1",
            views=45000,
            likes=2100,
            comments=89,
        ),
        CollectedPost(
            external_id="ig-2",
            published_at=base - timedelta(days=4),
            format_type="carousel",
            caption="کاروسل: مقایسه ابزارهای آنالیز رقبا — اسلاید آخر لینک بیو",
            url=f"https://instagram.com/p/mock2",
            likes=890,
            comments=34,
        ),
        CollectedPost(
            external_id="ig-3",
            published_at=base - timedelta(days=6),
            format_type="single_image",
            caption="پست حمایت‌شده: همکاری با برند چراغ",
            url=f"https://instagram.com/p/mock3",
            likes=400,
            comments=12,
        ),
    ]


def mock_youtube_posts(channel_id: str) -> list[CollectedPost]:
    base = datetime.utcnow()
    return [
        CollectedPost(
            external_id="yt-long-1",
            published_at=base - timedelta(days=8),
            format_type="long_video",
            caption="آموزش کامل تحلیل رقبا در یوتیوب — ۲۵ دقیقه",
            url="https://youtube.com/watch?v=mocklong",
            views=120000,
            likes=3400,
            comments=210,
            raw_meta={"duration_seconds": 1520},
        ),
        CollectedPost(
            external_id="yt-short-1",
            published_at=base - timedelta(days=2),
            format_type="short",
            caption="شورت: یک ترفند برای عنوان ویدیو #shorts",
            url="https://youtube.com/shorts/mockshort",
            views=89000,
            likes=4100,
            comments=55,
            raw_meta={"duration_seconds": 42},
        ),
        CollectedPost(
            external_id="yt-long-2",
            published_at=base - timedelta(days=15),
            format_type="long_video",
            caption="اسپانسری: معرفی پلتفرم Pagezy با لینک تخفیف",
            url="https://youtube.com/watch?v=mockpromo",
            views=15000,
            likes=200,
            comments=18,
            raw_meta={"duration_seconds": 600},
        ),
    ]