/**
 * Zernio wrapper for Meta Business Discovery (documented).
 * GET /v1/accounts/{accountId}/instagram/business-discovery
 * https://docs.zernio.com/instagram/get-instagram-business-discovery.mdx
 *
 * Requires connected IG via Facebook Login (owner: Alsafari @alsafaridev7).
 */
import type { Env } from "../../env";
import type { CollectedPost } from "../../types";
import { mapMediaType } from "../instagram/metaBusinessDiscovery";
import { zernioGet } from "./client";

const PROBE_KV = "zernio:business_discovery_probe";

export async function fetchViaZernioBusinessDiscovery(
  env: Env,
  targetUsername: string,
  limit = 50,
): Promise<CollectedPost[]> {
  const accountId = env.ZERNIO_INSTAGRAM_ACCOUNT_ID;
  if (!env.ZERNIO_API_KEY || !accountId) {
    throw new Error("ZERNIO_API_KEY و ZERNIO_INSTAGRAM_ACCOUNT_ID برای Business Discovery لازم است.");
  }
  const username = targetUsername.replace(/^@/, "");
  const res = await zernioGet(env, `/accounts/${accountId}/instagram/business-discovery`, {
    username,
    limit,
  });
  if (res.status === 400) {
    const body = await res.json().catch(() => ({}));
    const code = (body as { code?: string }).code;
    if (code === "instagram_business_discovery_requires_facebook_login") {
      throw new Error("Zernio: اتصال اینستا باید با Facebook Login باشد (Business Discovery).");
    }
  }
  if (!res.ok) {
    throw new Error(`Zernio business-discovery HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as ZernioBdResponse;
  const media = json.media ?? [];
  return media.map((m) => ({
    externalId: m.id,
    publishedAt: m.timestamp ?? new Date().toISOString(),
    formatType: mapMediaType(m.mediaProductType, m.mediaType),
    caption: (m.caption ?? "").slice(0, 4000),
    url: m.permalink ?? "",
    views: m.viewCount ?? null,
    likes: m.likeCount ?? null,
    comments: m.commentsCount ?? null,
    raw: { source: "zernio_business_discovery", profile: json.profile },
  }));
}

/** One-time probe at startup (cron); stores result in KV. */
export async function probeZernioBusinessDiscovery(env: Env): Promise<void> {
  if (!env.ZERNIO_API_KEY || !env.ZERNIO_INSTAGRAM_ACCOUNT_ID) return;
  const cached = await env.CACHE.get(PROBE_KV);
  if (cached) return;
  try {
    const res = await zernioGet(env, `/accounts/${env.ZERNIO_INSTAGRAM_ACCOUNT_ID}/instagram/business-discovery`, {
      username: "instagram",
      limit: 1,
    });
    await env.CACHE.put(
      PROBE_KV,
      JSON.stringify({
        ok: res.ok,
        status: res.status,
        probedAt: new Date().toISOString(),
        endpoint: "/v1/accounts/{id}/instagram/business-discovery",
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

interface ZernioBdResponse {
  profile?: Record<string, unknown>;
  media?: {
    id: string;
    caption?: string | null;
    mediaType?: string | null;
    mediaProductType?: string | null;
    timestamp?: string | null;
    permalink?: string | null;
    likeCount?: number | null;
    commentsCount?: number | null;
    viewCount?: number | null;
  }[];
}