import type { Env } from "../../env";
import { isMock as mockFlag } from "../../env";
import type { CollectedPost, TimeRange } from "../../types";
import { fetchConnectedInstagramPosts } from "../zernio/analytics";
import { fetchViaZernioBusinessDiscovery } from "../zernio/businessDiscovery";
import { mockInstagram } from "../mock";
import { competitorInstagramUnavailableMessage, fetchCompetitorInstagram } from "./competitor";
import { fetchViaMetaBusinessDiscovery } from "./metaBusinessDiscovery";

/**
 * Instagram collection:
 * 1. Own account — Zernio GET /v1/analytics (connected accountId)
 * 2. Competitor — Meta Graph Business Discovery (primary)
 * 3. Competitor fallback — Zernio GET .../instagram/business-discovery (documented)
 * 4. Optional Apify / scraper
 */
export async function collectInstagram(
  env: Env,
  identifier: string,
  range: TimeRange,
): Promise<CollectedPost[]> {
  if (mockFlag(env)) {
    return mockInstagram(identifier.replace(/^@/, "").split("/").pop() ?? "demo");
  }

  const accountId = env.ZERNIO_INSTAGRAM_ACCOUNT_ID;
  const idNorm = identifier.trim();
  const isConnectedRequest =
    accountId &&
    (idNorm === accountId ||
      idNorm.toLowerCase().includes("alsafari") ||
      idNorm === "@alsafaridev7" ||
      idNorm.toLowerCase().includes("pagezy") ||
      idNorm === "connected");

  if (isConnectedRequest && accountId) {
    return fetchConnectedInstagramPosts(env, accountId, range);
  }

  const target = identifier;

  if (env.META_IG_USER_ID && env.META_ACCESS_TOKEN) {
    try {
      return await fetchViaMetaBusinessDiscovery(env, target, 50);
    } catch (metaErr) {
      if (env.ZERNIO_API_KEY && env.ZERNIO_INSTAGRAM_ACCOUNT_ID) {
        try {
          return await fetchViaZernioBusinessDiscovery(env, target, 50);
        } catch {
          throw metaErr;
        }
      }
      throw metaErr;
    }
  }

  if (env.ZERNIO_API_KEY && env.ZERNIO_INSTAGRAM_ACCOUNT_ID) {
    return fetchViaZernioBusinessDiscovery(env, target, 50);
  }

  if (env.APIFY_API_TOKEN || env.INSTAGRAM_SCRAPER_BASE_URL) {
    try {
      return await fetchCompetitorInstagram(env, identifier);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : competitorInstagramUnavailableMessage());
    }
  }

  throw new Error(competitorInstagramUnavailableMessage());
}