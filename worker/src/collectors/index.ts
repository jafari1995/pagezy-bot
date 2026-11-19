import type { CollectedPost, Platform, TimeRange } from "../types";
import type { Env } from "../env";
import { collectInstagram } from "./instagram";
import { collectTelegram } from "./telegram";
import { collectYoutube } from "./youtube";

export function filterByRange(posts: CollectedPost[], range: TimeRange): CollectedPost[] {
  const { start, end } = resolveRange(range);
  return posts.filter((p) => {
    const t = new Date(p.publishedAt).getTime();
    if (start && t < start) return false;
    if (end && t > end) return false;
    return true;
  });
}

export function resolveRange(range: TimeRange): { start?: number; end?: number } {
  const now = Date.now();
  const day = 86400000;
  switch (range.kind) {
    case "last_week":
      return { start: now - 7 * day, end: now };
    case "last_month":
      return { start: now - 30 * day, end: now };
    case "all":
      return {};
    case "custom":
      return {
        start: range.start ? new Date(range.start).getTime() : undefined,
        end: range.end ? new Date(range.end).getTime() : now,
      };
    default:
      return { start: now - 7 * day, end: now };
  }
}

export async function collectPosts(
  env: Env,
  platform: Platform,
  identifier: string,
  range: TimeRange,
): Promise<CollectedPost[]> {
  let posts: CollectedPost[];
  switch (platform) {
    case "telegram":
      posts = await collectTelegram(env, identifier);
      break;
    case "instagram":
      posts = await collectInstagram(env, identifier, range);
      break;
    case "youtube":
      posts = await collectYoutube(env, identifier);
      break;
    default:
      posts = [];
  }
  return filterByRange(posts, range);
}