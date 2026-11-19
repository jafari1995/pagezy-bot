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
  ZARINO_API_KEY?: string;
  ZARINO_API_BASE_URL?: string;
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

export const FREE_MODELS = [
  "google/gemma-2-9b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "qwen/qwen-2-7b-instruct:free",
];

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