/**
 * Zernio Business Discovery (primary competitor IG path).
 * GET /v1/accounts/{accountId}/instagram/business-discovery?username=&limit=
 * Response: { profile: {...}, media: [...] } — camelCase fields per docs.
 */
import type { Env } from "../../env";
import type { CollectedPost } from "../../types";
import { mapMediaType } from "../instagram/metaBusinessDiscovery";
import { zernioGet } from "./client";
import { resolvedZernioInstagramAccountId } from "./defaults";

const PROBE_KV = "zernio:business_discovery_probe";

export async function fetchViaZernioBusinessDiscovery(
  env: Env,
  targetUsername: string,
  limit = 50,
): Promise<CollectedPost[]> {
  if (!env.ZERNIO_API_KEY) {
    throw new Error("ZERNIO_API_KEY برای جستجوی رقیب اینستاگرام لازم است.");
  }
  const accountId = resolvedZernioInstagramAccountId(env);
  const username = extractIgUsername(targetUsername);

  const res = await zernioGet(env, `/accounts/${accountId}/instagram/business-discovery`, {
    username,
    limit: Math.min(Math.max(limit, 1), 50),
  });

  if (res.status === 400) {
    const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
    if (body.code === "instagram_business_discovery_requires_facebook_login") {
      throw new Error("Zernio: اینستا باید با Facebook Login متصل باشد (Business Discovery).");
    }
    throw new Error(body.error ?? `Zernio 400: ${body.code ?? "bad_request"}`);
  }
  if (!res.ok) {
    throw new Error(`Zernio business-discovery HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const json = (await res.json()) as ZernioBusinessDiscoveryResponse;
  if (!json.media?.length) {
    throw new Error(`حساب @${username} رسانه‌ای برنگرداند (خصوصی، شخصی، یا نامعتبر).`);
  }

  return json.media.map((m) => mapZernioMedia(m, json.profile));
}

export function mapZernioMedia(m: ZernioMediaItem, profile?: ZernioProfile): CollectedPost {
  return {
    externalId: m.id,
    publishedAt: m.timestamp ?? new Date().toISOString(),
    formatType: mapMediaType(m.mediaProductType, m.mediaType),
    caption: (m.caption ?? "").slice(0, 4000),
    url: m.permalink ?? "",
    views: m.viewCount ?? null,
    likes: m.likeCount ?? null,
    comments: m.commentsCount ?? null,
    raw: {
      source: "zernio_business_discovery",
      mediaType: m.mediaType,
      mediaProductType: m.mediaProductType,
      mediaUrl: m.mediaUrl,
      thumbnailUrl: m.thumbnailUrl,
      competitorUsername: profile?.username,
      followersCount: profile?.followersCount,
      viewsNote:
        m.viewCount == null
          ? "viewCount فقط برای Reels؛ تصاویر/کاروسل معمولاً null"
          : undefined,
    },
  };
}

export async function probeZernioBusinessDiscovery(env: Env): Promise<void> {
  if (!env.ZERNIO_API_KEY) return;
  const cached = await env.CACHE.get(PROBE_KV);
  if (cached) return;
  const accountId = resolvedZernioInstagramAccountId(env);
  try {
    const res = await zernioGet(env, `/accounts/${accountId}/instagram/business-discovery`, {
      username: "instagram",
      limit: 1,
    });
    await env.CACHE.put(
      PROBE_KV,
      JSON.stringify({
        ok: res.ok,
        status: res.status,
        probedAt: new Date().toISOString(),
        accountId,
      }),
      { expirationTtl: 86400 },
    );
  } catch (e) {
    await env.CACHE.put(
      PROBE_KV,
      JSON.stringify({ ok: false, error: String(e), probedAt: new Date().toISOString() }),
      { expirationTtl: 3600 },
    );
  }
}

function extractIgUsername(value: string): string {
  const v = value.trim().replace(/\/$/, "");
  const m = v.match(/instagram\.com\/([^/?]+)/i);
  if (m) return m[1].replace("@", "").toLowerCase();
  return v.replace(/^@/, "").toLowerCase();
}

export interface ZernioProfile {
  id: string;
  username: string;
  name?: string | null;
  biography?: string | null;
  website?: string | null;
  profilePictureUrl?: string | null;
  followersCount?: number | null;
  followsCount?: number | null;
  mediaCount?: number | null;
}

export interface ZernioMediaItem {
  id: string;
  caption?: string | null;
  mediaType?: string | null;
  mediaProductType?: string | null;
  timestamp?: string | null;
  permalink?: string | null;
  likeCount?: number | null;
  commentsCount?: number | null;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  viewCount?: number | null;
  children?: unknown[] | null;
}

interface ZernioBusinessDiscoveryResponse {
  profile: ZernioProfile;
  media: ZernioMediaItem[];
}