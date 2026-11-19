import type { CollectedPost } from "../types";

export function mockTelegram(channel: string): CollectedPost[] {
  const now = Date.now();
  const day = 86400000;
  return [
    {
      externalId: "tg-1001",
      publishedAt: new Date(now - 2 * day).toISOString(),
      formatType: "voice_note",
      caption: "آموزش سریع: فروش با ربات تلگرام",
      url: `https://t.me/${channel}/1001`,
      views: 12400,
      forwards: 89,
    },
    {
      externalId: "tg-1002",
      publishedAt: new Date(now - 2 * day - 3600000).toISOString(),
      formatType: "image_text",
      caption: "کاور + متن: معرفی Pagezy @pagezy_bot",
      url: `https://t.me/${channel}/1002`,
      views: 8900,
    },
    {
      externalId: "tg-1004",
      publishedAt: new Date(now - 10 * 3600000).toISOString(),
      formatType: "image_text",
      caption: "تبلیغ: تخفیف PAGEZY30 برای ابزار SEO چراغ",
      url: `https://t.me/${channel}/1004`,
      views: 3200,
    },
  ];
}

export function mockInstagram(username: string): CollectedPost[] {
  const now = Date.now();
  return [
    {
      externalId: "ig-1",
      publishedAt: new Date(now - 3 * 86400000).toISOString(),
      formatType: "reel",
      caption: "ریلز آموزشی کپشن‌نویسی",
      url: `https://instagram.com/${username}/p/mock1`,
      views: 45000,
      likes: 2100,
      comments: 89,
    },
    {
      externalId: "ig-3",
      publishedAt: new Date(now - 6 * 86400000).toISOString(),
      formatType: "single_image",
      caption: "همکاری با برند چراغ",
      url: `https://instagram.com/${username}/p/mock3`,
      likes: 400,
    },
  ];
}

export function mockYoutube(): CollectedPost[] {
  const now = Date.now();
  return [
    {
      externalId: "yt-short",
      publishedAt: new Date(now - 2 * 86400000).toISOString(),
      formatType: "short",
      caption: "شورت: ترفند عنوان #shorts",
      url: "https://youtube.com/shorts/mock",
      views: 89000,
      likes: 4100,
    },
    {
      externalId: "yt-long",
      publishedAt: new Date(now - 8 * 86400000).toISOString(),
      formatType: "long_video",
      caption: "آموزش تحلیل رقبا",
      url: "https://youtube.com/watch?v=mock",
      views: 120000,
      likes: 3400,
    },
  ];
}