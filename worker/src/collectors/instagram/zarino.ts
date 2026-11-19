import type { CollectedPost } from "../../types";
import type { Env } from "../../env";

/**
 * Zarino Instagram adapter (primary).
 *
 * Public docs for «Zarino» were not found during implementation (distinct from zernio.com / zarrino.io corp site).
 * Configure via:
 *   ZARINO_API_KEY
 *   ZARINO_API_BASE_URL (e.g. https://api.zarino.example)
 *
 * Expected contract (confirm with Zarino/Pagezy team — adjust ZARINO_POSTS_PATH if different):
 *   GET {base}{path}?username={user}&from=YYYY-MM-DD&to=YYYY-MM-DD
 *   Authorization: Bearer {ZARINO_API_KEY}
 *
 * Response shape (flexible mapper):
 *   { data: { posts: [ { id, caption, published_at, type, url, views, likes, comments } ] } }
 *   OR { posts: [...] }
 *
 * TODO(owner): Paste OpenAPI path + field mapping from Zarino when available.
 */
const DEFAULT_POSTS_PATH = "/v1/instagram/profile/posts";

export async function fetchInstagramViaZarino(env: Env, linkOrUser: string): Promise<CollectedPost[]> {
  const base = (env.ZARINO_API_BASE_URL ?? "").replace(/\/$/, "");
  if (!base) {
    throw new Error("ZARINO_API_BASE_URL خالی است — URL پایه API Zarino را در wrangler secret تنظیم کنید.");
  }
  const username = extractUsername(linkOrUser);
  const path = (env as Env & { ZARINO_POSTS_PATH?: string }).ZARINO_POSTS_PATH ?? DEFAULT_POSTS_PATH;
  const url = new URL(base + path);
  url.searchParams.set("username", username);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${env.ZARINO_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("احراز هویت Zarino ناموفق — کلید API را بررسی کنید.");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zarino HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as Record<string, unknown>;
  const rawPosts = extractPostsArray(json);
  if (!rawPosts.length) {
    throw new Error("Zarino پستی برنگرداند (ممکن است endpoint یا username اشتباه باشد).");
  }

  return rawPosts.map(mapZarinoPost).filter(Boolean) as CollectedPost[];
}

function extractPostsArray(json: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(json.posts)) return json.posts as Record<string, unknown>[];
  const data = json.data as Record<string, unknown> | undefined;
  if (data && Array.isArray(data.posts)) return data.posts as Record<string, unknown>[];
  if (Array.isArray(json.items)) return json.items as Record<string, unknown>[];
  return [];
}

function mapZarinoPost(item: Record<string, unknown>): CollectedPost | null {
  const id = String(item.id ?? item.post_id ?? item.shortcode ?? "");
  if (!id) return null;
  const caption = String(item.caption ?? item.text ?? "");
  const published = String(
    item.published_at ?? item.timestamp ?? item.taken_at ?? new Date().toISOString(),
  );
  const type = String(item.type ?? item.media_type ?? "post").toLowerCase();
  let formatType = "single_image";
  if (type.includes("reel") || type.includes("video")) formatType = "reel";
  else if (type.includes("carousel") || type.includes("sidecar")) formatType = "carousel";

  return {
    externalId: id,
    publishedAt: new Date(published).toISOString(),
    formatType,
    caption,
    url: String(item.url ?? item.permalink ?? ""),
    views: num(item.views ?? item.play_count ?? item.video_view_count),
    likes: num(item.likes ?? item.like_count),
    comments: num(item.comments ?? item.comment_count),
    raw: item,
  };
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractUsername(value: string): string {
  const v = value.trim().replace(/\/$/, "");
  const m = v.match(/instagram\.com\/([^/?]+)/i);
  if (m) return m[1].replace("@", "");
  return v.replace(/^@/, "");
}