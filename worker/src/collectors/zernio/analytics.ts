/**
 * Zernio Analytics — only for accounts connected to your Zernio team.
 * GET /v1/analytics — post list with metrics (docs: get-analytics.mdx)
 * GET /v1/analytics/instagram/account-insights — account-level IG insights
 */
import type { Env } from "../../env";
import type { CollectedPost, TimeRange } from "../../types";
import { resolveRange } from "../index";
import { zernioGet } from "./client";

export async function fetchConnectedInstagramPosts(
  env: Env,
  accountId: string,
  range: TimeRange,
): Promise<CollectedPost[]> {
  const { start, end } = resolveRange(range);
  const fromDate = start ? new Date(start).toISOString().slice(0, 10) : undefined;
  const toDate = end ? new Date(end).toISOString().slice(0, 10) : undefined;

  const res = await zernioGet(env, "/analytics", {
    accountId,
    platform: "instagram",
    fromDate,
    toDate,
    limit: 100,
    page: 1,
    view: "summary",
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("Zernio: دسترسی analytics رد شد — کلید یا accountId را بررسی کنید.");
  }
  if (!res.ok) {
    throw new Error(`Zernio analytics HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const json = (await res.json()) as AnalyticsListResponse;
  const posts = json.posts ?? [];
  return posts.map(mapAnalyticsPost).filter(Boolean) as CollectedPost[];
}

export async function fetchInstagramAccountInsights(env: Env, accountId: string) {
  const res = await zernioGet(env, "/analytics/instagram/account-insights", { accountId });
  if (!res.ok) throw new Error(`Zernio account-insights: ${res.status}`);
  return res.json();
}

interface AnalyticsListResponse {
  posts?: AnalyticsPost[];
}

interface AnalyticsPost {
  postId?: string;
  publishedAt?: string;
  content?: string;
  platformPostUrl?: string;
  mediaType?: string;
  analytics?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    impressions?: number;
    reach?: number;
  };
  platformAnalytics?: { platform?: string; platformPostUrl?: string; analytics?: AnalyticsPost["analytics"] }[];
}

function mapAnalyticsPost(p: AnalyticsPost): CollectedPost | null {
  const id = p.postId;
  if (!id) return null;
  const ig = p.platformAnalytics?.find((x) => x.platform === "instagram");
  const metrics = p.analytics ?? ig?.analytics ?? {};
  const url = p.platformPostUrl ?? ig?.platformPostUrl ?? "";
  const mt = (p.mediaType ?? "").toLowerCase();
  let formatType = "single_image";
  if (mt.includes("reel") || mt.includes("video")) formatType = "reel";
  else if (mt.includes("carousel")) formatType = "carousel";

  return {
    externalId: String(id),
    publishedAt: p.publishedAt ?? new Date().toISOString(),
    formatType,
    caption: (p.content ?? "").slice(0, 4000),
    url,
    views: metrics.views ?? null,
    likes: metrics.likes ?? null,
    comments: metrics.comments ?? null,
    raw: { source: "zernio_connected" },
  };
}