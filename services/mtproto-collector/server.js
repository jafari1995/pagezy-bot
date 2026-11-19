/**
 * MTProto collector for Cloudflare Containers (GramJS).
 * Worker calls POST /collect with { channel, limit }.
 *
 * Env: TG_API_ID, TG_API_HASH, TG_SESSION_STRING, COLLECTOR_TOKEN, MOCK_MODE
 */
import express from "express";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/collect", async (req, res) => {
  const token = process.env.COLLECTOR_TOKEN;
  if (token && req.headers.authorization !== `Bearer ${token}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { channel, limit = 100 } = req.body ?? {};
  if (!channel) return res.status(400).json({ error: "channel required" });

  if (process.env.MOCK_MODE === "true") {
    const name = String(channel).replace(/^@/, "");
    return res.json({
      posts: [
        {
          externalId: "1",
          publishedAt: new Date().toISOString(),
          formatType: "text_news",
          caption: "تحلیل بازار",
          url: `https://t.me/${name}/1`,
          views: 9000,
        },
      ],
    });
  }

  const apiId = Number(process.env.TG_API_ID);
  const apiHash = process.env.TG_API_HASH;
  const session = process.env.TG_SESSION_STRING;
  if (!apiId || !apiHash || !session) {
    return res.status(500).json({ error: "TG session env missing" });
  }

  try {
    const { TelegramClient } = await import("telegram");
    const { StringSession } = await import("telegram/sessions/index.js");
    const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
    await client.connect();
    const entity = await client.getEntity(channel);
    const posts = [];
    const messages = await client.getMessages(entity, { limit: Math.min(limit, 500) });
    const username = entity.username ?? String(channel).replace(/^@/, "");
    for (const message of messages) {
      if (!message?.id) continue;
      posts.push({
        externalId: String(message.id),
        publishedAt: (message.date ?? new Date()).toISOString(),
        formatType: message.voice ? "voice_note" : message.video ? "video" : message.photo ? "image_text" : "text_news",
        caption: message.message ?? "",
        url: `https://t.me/${username}/${message.id}`,
        views: message.views ?? null,
        forwards: message.forwards ?? null,
      });
    }
    await client.disconnect();
    res.json({ posts });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`mtproto collector on ${port}`));