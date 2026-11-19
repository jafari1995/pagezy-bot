from pagezy_bot.analysis.promo import detect_promotional


def test_detect_promo_discount():
    ok, _ = detect_promotional("تخفیف ۳۰٪ کد PAGEZY30")
    assert ok


def test_regular_news_not_promo():
    ok, _ = detect_promotional("تحلیل خبر بازار ارز دیجیتال")
    assert not ok