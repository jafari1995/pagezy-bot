/**
 * Meta Graph API Business Discovery — competitor public Business/Creator accounts.
 * Requires META_IG_USER_ID (your connected IG user id) + META_ACCESS_TOKEN.
 * Views are generally NOT returned on competitor media via this API — use likes/comments.
 */
import type { Env } from "../../env";
import type { CollectedPost } from "../../types";

const DEFAULT_GRAPH_VERSION = "v22.0";

export async function fetchViaMetaBusinessDiscovery(
  env: Env,
  targetUsername: string,
  maxPosts = 50,
): Promise<CollectedPost[]> {
  const igUserId = env.META_IG_USER_ID;
  const token = env.META_ACCESS_TOKEN;
  if (!igUserId || !token) {
    throw new Error(
      "برای پست‌های رقیب اینستا، META_IG_USER_ID و META_ACCESS_TOKEN (Business Discovery) را تنظیم کنید.",
    );
  }

  const username = targetUsername.replace(/^@/, "").toLowerCase();
  const version = env.META_GRAPH_VERSION ?? DEFAULT_GRAPH_VERSION;
  const posts: CollectedPost[] = [];
  let after: string | undefined;

  while (posts.length < maxPosts) {
    const limit = Math.min(25, maxPosts - posts.length);
    const fields = buildFields(username, limit, after);
    const url = `https://graph.facebook.com/${version}/${igUserId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const json = (await res.json()) as MetaBdResponse;
    if (!res.ok) {
      throw new Error(
        `Meta Business Discovery: ${json.error?.message ?? res.status} (type=${json.error?.type ?? "?"})`,
      );
    }
    const bd = json.business_discovery;
    if (!bd?.media?.data?.length) break;

    for (const m of bd.media.data) {
      posts.push(mapMedia(m, username));
    }
    after = bd.media.paging?.cursors?.after;
    if (!after) break;
  }

  if (!posts.length) {
    throw new Error(
      `حساب @${username} پیدا نشد یا خصوصی/شخصی است — Business Discovery فقط Business/Creator عمومی.`,
    );
  }
  return posts;
}

function buildFields(username: string, limit: number, after?: string): string {
  const mediaInner =
    "id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink";
  const mediaPart = after
    ? `media.after(${after}).limit(${limit}){${mediaInner}}`
    : `media.limit(${limit}){${mediaInner}}`;
  return `business_discovery.username(${username}){username,followers_count,media_count,${mediaPart}}`;
}

export function mapMediaType(mediaProductType?: string | null, mediaType?: string | null): string {
  const product = (mediaProductType ?? "").toUpperCase();
  const mt = (mediaType ?? "").toUpperCase();
  if (product === "REELS" || product === "REEL") return "reel";
  if (product === "STORY") return "story";
  if (mt === "CAROUSEL_ALBUM" || product === "CAROUSEL_ALBUM") return "carousel";
  if (mt === "VIDEO" && product === "FEED") return "video";
  if (mt === "IMAGE" || product === "FEED") return "single_image";
  return "single_image";
}

function mapMedia(m: MetaMediaNode, competitor: string): CollectedPost {
  return {
    externalId: m.id,
    publishedAt: m.timestamp ?? new Date().toISOString(),
    formatType: mapMediaType(m.media_product_type, m.media_type),
    caption: (m.caption ?? "").slice(0, 4000),
    url: m.permalink ?? `https://www.instagram.com/${competitor}/`,
    views: null,
    likes: m.like_count ?? null,
    comments: m.comments_count ?? null,
    raw: {
      source: "meta_business_discovery",
      media_type: m.media_type,
      media_product_type: m.media_product_type,
      views_note: "Meta Business Discovery: views not exposed for competitor feed media",
    },
  };
}

interface MetaBdResponse {
  business_discovery?: {
    username?: string;
    followers_count?: number;
    media_count?: number;
    media?: {
      data?: MetaMediaNode[];
      paging?: { cursors?: { after?: string } };
    };
  };
  error?: { message?: string; type?: string; code?: number };
}

interface MetaMediaNode {
  id: string;
  caption?: string | null;
  media_type?: string | null;
  media_product_type?: string | null;
  timestamp?: string | null;
  like_count?: number | null;
  comments_count?: number | null;
  permalink?: string | null;
}