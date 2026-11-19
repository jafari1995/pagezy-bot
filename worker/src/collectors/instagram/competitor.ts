/**
 * Optional third-party competitor Instagram scraping (NOT Zernio — cannot read arbitrary profiles).
 */
import type { Env } from "../../env";
import type { CollectedPost } from "../../types";

const COMPETITOR_IG_MESSAGE_FA =
  "پست‌های اینستاگرامِ رقبا با Zernio در دسترس نیست (فقط حساب‌های متصل به تیم شما). " +
  "برای رقیب، APIFY_API_TOKEN یا INSTAGRAM_SCRAPER_BASE_URL را تنظیم کنید؛ وگرنه فقط Ad Library یا تلگرام/یوتیوب.";

export async function fetchCompetitorInstagram(
  env: Env,
  linkOrUser: string,
): Promise<CollectedPost[]> {
  const username = extractUsername(linkOrUser);

  if (env.APIFY_API_TOKEN) {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${env.APIFY_API_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [username], resultsLimit: 50 }),
      },
    );
    if (res.ok) {
      const items = (await res.json()) as Record<string, unknown>[];
      const posts = items.map(mapApify).filter(Boolean) as CollectedPost[];
      if (posts.length) return posts;
    }
  }

  if (env.INSTAGRAM_SCRAPER_BASE_URL) {
    const url = new URL(env.INSTAGRAM_SCRAPER_BASE_URL.replace(/\/$/, "") + "/profile");
    url.searchParams.set("username", username);
    const res = await fetch(url.toString());
    if (res.ok) {
      const json = (await res.json()) as { posts?: Record<string, unknown>[] };
      const posts = (json.posts ?? []).map(mapGeneric).filter(Boolean) as CollectedPost[];
      if (posts.length) return posts;
    }
  }

  throw new Error(COMPETITOR_IG_MESSAGE_FA);
}

export function competitorInstagramUnavailableMessage(): string {
  return COMPETITOR_IG_MESSAGE_FA;
}

function mapApify(item: Record<string, unknown>): CollectedPost | null {
  const id = String(item.id ?? item.shortCode ?? "");
  if (!id) return null;
  return {
    externalId: id,
    publishedAt: new Date(Number(item.timestamp) * 1000 || Date.now()).toISOString(),
    formatType: item.isVideo ? "reel" : "single_image",
    caption: String(item.caption ?? ""),
    url: String(item.url ?? ""),
    likes: num(item.likesCount),
    comments: num(item.commentsCount),
    views: num(item.videoViewCount ?? item.playCount),
    raw: { source: "apify" },
  };
}

function mapGeneric(item: Record<string, unknown>): CollectedPost | null {
  const id = String(item.id ?? "");
  if (!id) return null;
  return {
    externalId: id,
    publishedAt: String(item.published_at ?? new Date().toISOString()),
    formatType: String(item.type ?? "post"),
    caption: String(item.caption ?? ""),
    url: String(item.url ?? ""),
    views: num(item.views),
    likes: num(item.likes),
    comments: num(item.comments),
    raw: { source: "scraper" },
  };
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractUsername(value: string): string {
  const v = value.trim().replace(/\/$/, "");
  const m = v.match(/instagram\.com\/([^/?]+)/i);
  if (m) return m[1].replace("@", "");
  return v.replace(/^@/, "");
}