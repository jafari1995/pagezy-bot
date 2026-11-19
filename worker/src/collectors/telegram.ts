import type { CollectedPost } from "../types";
import type { Env } from "../env";
import { isMock } from "../env";
import { mockTelegram } from "./mock";

/**
 * Telegram via GramJS inside MtprotoCollector Durable Object (Workers-native).
 * Optional fallback: MTPROTO_COLLECTOR_URL (Container) if GramJS bundle fails in your account.
 */
export async function collectTelegram(env: Env, identifier: string): Promise<CollectedPost[]> {
  const channel = identifier.replace(/^https?:\/\/t\.me\//, "").replace(/^@/, "");
  if (isMock(env)) return mockTelegram(channel);

  if (env.MTPROTO_COLLECTOR_URL) {
    const res = await fetch(`${env.MTPROTO_COLLECTOR_URL.replace(/\/$/, "")}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: identifier, limit: 200 }),
    });
    if (!res.ok) throw new Error(`MTProto fallback: ${await res.text()}`);
    const data = (await res.json()) as { posts: CollectedPost[] };
    return data.posts ?? [];
  }

  if (!env.MTPROTO) {
    throw new Error("binding MTPROTO (Durable Object) missing in wrangler.toml");
  }
  const id = env.MTPROTO.idFromName("primary");
  const stub = env.MTPROTO.get(id);
  const res = await stub.fetch("https://mtproto.internal/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: identifier, limit: 200 }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `MTProto DO: ${res.status}`);
  }
  const data = (await res.json()) as { posts: CollectedPost[] };
  return data.posts ?? [];
}