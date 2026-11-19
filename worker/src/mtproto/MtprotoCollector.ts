/**
 * Durable Object: ephemeral GramJS MTProto reads (preferred over Containers).
 *
 * Why DO (not plain Worker isolate)?
 * - MTProto sessions benefit from single-writer semantics and FloodWait cooldown state.
 * - GramJS uses Node crypto/TCP; `nodejs_compat` + DO avoids cross-request session races.
 *
 * Why not Telethon?
 * - Python does not run on Workers.
 */
import type { CollectedPost } from "../types";

export interface MtprotoEnv {
  TG_API_ID?: string;
  TG_API_HASH?: string;
  TG_SESSION_STRING?: string;
  MOCK_MODE?: string;
}

export class MtprotoCollector implements DurableObject {
  constructor(
    private state: DurableObjectState,
    private env: MtprotoEnv,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }
    const body = (await request.json()) as { channel?: string; limit?: number };
    if (!body.channel) return Response.json({ error: "channel required" }, { status: 400 });

    if ((this.env.MOCK_MODE ?? "false").toLowerCase() === "true") {
      const name = body.channel.replace(/^@/, "");
      const post: CollectedPost = {
        externalId: "mock-1",
        publishedAt: new Date().toISOString(),
        formatType: "text_news",
        caption: "تحلیل Mock — چراغ PAGEZY30",
        url: `https://t.me/${name}/1`,
        views: 9000,
      };
      return Response.json({ posts: [post] });
    }

    const apiId = Number(this.env.TG_API_ID);
    const apiHash = this.env.TG_API_HASH ?? "";
    const session = this.env.TG_SESSION_STRING ?? "";
    if (!apiId || !apiHash || !session) {
      return Response.json(
        { error: "TG_API_ID, TG_API_HASH, TG_SESSION_STRING secrets missing" },
        { status: 500 },
      );
    }

    const floodKey = "flood_until";
    const floodUntil = (await this.state.storage.get<number>(floodKey)) ?? 0;
    if (Date.now() < floodUntil) {
      return Response.json(
        { error: `FloodWait: retry after ${new Date(floodUntil).toISOString()}` },
        { status: 429 },
      );
    }

    try {
      const posts = await collectWithGramJs(body.channel, body.limit ?? 100, apiId, apiHash, session);
      return Response.json({ posts });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const fw = msg.match(/FLOOD_WAIT[_\s](\d+)/i) ?? msg.match(/(\d+)\s*seconds/i);
      if (fw) {
        const sec = Number(fw[1]);
        await this.state.storage.put(floodKey, Date.now() + sec * 1000);
      }
      return Response.json({ error: msg }, { status: 502 });
    }
  }
}

async function collectWithGramJs(
  channel: string,
  limit: number,
  apiId: number,
  apiHash: string,
  sessionString: string,
): Promise<CollectedPost[]> {
  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions");
  const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 2,
    useWSS: true,
  });
  await client.connect();
  try {
    const entity = await client.getEntity(channel);
    const username = (entity as { username?: string }).username ?? channel.replace(/^@/, "");
    const messages = await client.getMessages(entity, { limit: Math.min(limit, 300) });
    const posts: CollectedPost[] = [];
    for (const message of messages) {
      if (!message?.id) continue;
      const m = message as {
        id: number;
        date?: Date;
        message?: string;
        views?: number;
        forwards?: number;
        voice?: unknown;
        video?: unknown;
        photo?: unknown;
      };
      let formatType = "text_news";
      if (m.voice) formatType = "voice_note";
      else if (m.video) formatType = "video";
      else if (m.photo) formatType = "image_text";
      posts.push({
        externalId: String(m.id),
        publishedAt: (m.date ?? new Date()).toISOString(),
        formatType,
        caption: m.message ?? "",
        url: `https://t.me/${username}/${m.id}`,
        views: m.views ?? null,
        forwards: m.forwards ?? null,
      });
    }
    return posts;
  } finally {
    await client.disconnect();
  }
}