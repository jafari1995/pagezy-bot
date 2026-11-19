import type { Env } from "../../env";
import { isMock as mockFlag } from "../../env";
import type { CollectedPost, TimeRange } from "../../types";
import { fetchConnectedInstagramPosts } from "../zernio/analytics";
import { mockInstagram } from "../mock";
import { competitorInstagramUnavailableMessage, fetchCompetitorInstagram } from "./competitor";

/**
 * Instagram collection strategy:
 * 1. Zernio GET /v1/analytics — only for your connected accountId (Pagezy own IG)
 * 2. Optional Apify / custom scraper — arbitrary competitor username
 * 3. Clear Persian error if neither applies
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
      idNorm.toLowerCase().includes("pagezy") ||
      idNorm === "zernio" ||
      idNorm === "connected");

  if (isConnectedRequest && accountId) {
    return fetchConnectedInstagramPosts(env, accountId, range);
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