from pagezy_bot.collectors.meta_business_discovery import _map_format


def test_map_format():
    assert _map_format("REELS", "VIDEO") == "reel"
    assert _map_format("FEED", "CAROUSEL_ALBUM") == "carousel"
    assert _map_format("FEED", "IMAGE") == "single_image"