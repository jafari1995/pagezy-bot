export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  EXPORTS: R2Bucket;
  MTPROTO: DurableObjectNamespace;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  ALLOWED_USER_IDS: string;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL?: string;
  YOUTUBE_API_KEY?: string;
  ZERNIO_API_KEY?: string;
  /** Zernio SocialAccount id for your connected Instagram (analytics) */
  ZERNIO_INSTAGRAM_ACCOUNT_ID?: string;
  /** Optional Zernio account for YouTube analytics */
  ZERNIO_YOUTUBE_ACCOUNT_ID?: string;
  /** Optional third-party competitor IG scraper (Apify sync) */
  APIFY_API_TOKEN?: string;
  /** Optional generic HTTP scraper base URL for competitor IG */
  INSTAGRAM_SCRAPER_BASE_URL?: string;
  TG_API_ID?: string;
  TG_API_HASH?: string;
  TG_SESSION_STRING?: string;
  /** Optional fallback only — prefer DO + GramJS */
  MTPROTO_COLLECTOR_URL?: string;
  MOCK_MODE?: string;
}

export const PAGEZY_SYSTEM_PROMPT_FA = `تو دستیار تحلیل محتوای برند Pagezy هستی.
مالک: حامد جعفری. لحن: صمیمی، روشن، مدرن و حرفه‌ای — فارسی روان.
گزارش‌ها خلاصه و دقیق باشند. اگر داده ناقص است صریح بگو.`;

export { PREFERRED_FREE_ORDER as FREE_MODELS } from "./llm/models";

export function assertFreeModel(model: string): void {
  if (!model.endsWith(":free")) {
    throw new Error(`Only OpenRouter :free models allowed, got ${model}`);
  }
}

export function isMock(env: Env): boolean {
  return (env.MOCK_MODE ?? "false").toLowerCase() === "true";
}

export function allowedUsers(env: Env): Set<string> {
  return new Set(
    (env.ALLOWED_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}