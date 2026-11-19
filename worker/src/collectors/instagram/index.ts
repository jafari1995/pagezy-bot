import type { Env } from "../../env";
import { isMock as mockFlag } from "../../env";
import type { CollectedPost, TimeRange } from "../../types";
import { fetchConnectedInstagramPosts } from "../zernio/analytics";
import { fetchViaZernioBusinessDiscovery } from "../zernio/businessDiscovery";
import { resolvedZernioInstagramAccountId } from "../zernio/defaults";
import { mockInstagram } from "../mock";
import { competitorInstagramUnavailableMessage, fetchCompetitorInstagram } from "./competitor";
import { fetchViaMetaBusinessDiscovery } from "./metaBusinessDiscovery";

/**
 * Instagram collection:
 * 1. Own account — Zernio GET /v1/analytics (connected accountId)
 * 2. Competitor — Zernio GET .../instagram/business-discovery (primary)
 * 3. Optional Meta Graph Business Discovery if META_* set
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

  const accountId = resolvedZernioInstagramAccountId(env);
  const idNorm = identifier.trim().toLowerCase();
  const isConnectedRequest =
    idNorm === accountId.toLowerCase() ||
    idNorm.includes("alsafari") ||
    idNorm === "@alsafaridev7" ||
    idNorm === "alsafaridev7" ||
    idNorm.includes("pagezy") ||
    idNorm === "connected";

  if (isConnectedRequest && env.ZERNIO_API_KEY) {
    return fetchConnectedInstagramPosts(env, accountId, range);
  }

  if (env.ZERNIO_API_KEY) {
    try {
      return await fetchViaZernioBusinessDiscovery(env, identifier, 50);
    } catch (zernioErr) {
      if (env.META_IG_USER_ID && env.META_ACCESS_TOKEN) {
        try {
          return await fetchViaMetaBusinessDiscovery(env, identifier, 50);
        } catch {
          throw zernioErr;
        }
      }
      throw zernioErr;
    }
  }

  if (env.META_IG_USER_ID && env.META_ACCESS_TOKEN) {
    return fetchViaMetaBusinessDiscovery(env, identifier, 50);
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