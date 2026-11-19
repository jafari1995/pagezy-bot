/**
 * GET /v1/ads/library — Meta public ad archive via Zernio (no accountId required for platform=meta).
 * Docs: https://docs.zernio.com/ad-library/search-ad-library.mdx
 */
import type { Env } from "../../env";
import { zernioGet } from "./client";

export interface AdLibraryHit {
  platform: string;
  text: string;
  advertiser?: string;
  startedAt?: string;
  raw: Record<string, unknown>;
}

export async function searchMetaAdLibrary(
  env: Env,
  query: string,
  opts?: { countries?: string; limit?: number; platforms?: string },
): Promise<AdLibraryHit[]> {
  const res = await zernioGet(env, "/ads/library", {
    platform: "meta",
    q: query,
    countries: opts?.countries ?? "IR,GB,DE", // EU/UK archive visibility for commercial ads
    limit: opts?.limit ?? 25,
    platforms: opts?.platforms ?? "INSTAGRAM,FACEBOOK",
    status: "ACTIVE",
  });

  if (res.status === 429) {
    const retry = res.headers.get("Retry-After");
    throw new Error(`Zernio Ad Library rate limit — ${retry ?? "?"}s`);
  }
  if (!res.ok) {
    throw new Error(`Ad Library HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }

  const body = (await res.json()) as { platform?: string; data?: Record<string, unknown>[] };
  const rows = body.data ?? [];
  return rows.map((row) => ({
    platform: body.platform ?? "meta",
    text: extractAdText(row),
    advertiser: String(row.page_name ?? row.pageName ?? row.advertiser ?? ""),
    startedAt: String(row.ad_delivery_start_time ?? row.startDate ?? ""),
    raw: row,
  }));
}

function extractAdText(row: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof row.ad_creative_bodies === "object" && Array.isArray(row.ad_creative_bodies)) {
    parts.push(...(row.ad_creative_bodies as string[]));
  }
  if (typeof row.ad_creative_link_titles === "object" && Array.isArray(row.ad_creative_link_titles)) {
    parts.push(...(row.ad_creative_link_titles as string[]));
  }
  if (row.snapshot) parts.push(JSON.stringify(row.snapshot).slice(0, 500));
  return parts.join("\n").slice(0, 2000) || JSON.stringify(row).slice(0, 800);
}

export function formatAdLibraryAlertFa(brand: string, hits: AdLibraryHit[]): string {
  if (!hits.length) {
    return `ℹ️ Ad Library (Meta/Instagram): تبلیغ فعالی برای «${brand}» در بازه EU/UK پیدا نشد. تبلیغات فقط-US ممکن است در آرشیو نباشند.`;
  }
  const lines = hits.slice(0, 3).map((h, i) => {
    return `${i + 1}) ${h.advertiser || "—"}\n${h.text.slice(0, 400)}\nتاریخ: ${h.startedAt || "—"}`;
  });
  return `🚨 Ad Library — «${brand}»\n\n${lines.join("\n\n")}`;
}