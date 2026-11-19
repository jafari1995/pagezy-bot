/**
 * Single-tenant persistence via Durable Object SQLite (no D1).
 * Queryable: brands, scan channels, optional post cache.
 */
import type { Env } from "../env";

type SqlStorage = DurableObjectState["storage"]["sql"];

export class PagezyStore implements DurableObject {
  private sql!: SqlStorage;
  private ready: Promise<void>;

  constructor(
    private state: DurableObjectState,
    _env: Env,
  ) {
    this.ready = state.blockConcurrencyWhile(async () => {
      this.sql = state.storage.sql;
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS user_states (
          user_id TEXT PRIMARY KEY,
          state_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tracked_sources (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_user_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          identifier TEXT NOT NULL,
          display_name TEXT,
          last_fetched_at TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(owner_user_id, platform, identifier)
        );
        CREATE TABLE IF NOT EXISTS posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platform TEXT NOT NULL,
          source_id INTEGER NOT NULL,
          external_id TEXT NOT NULL,
          published_at TEXT NOT NULL,
          format_type TEXT NOT NULL,
          caption TEXT,
          url TEXT,
          views INTEGER,
          likes INTEGER,
          comments INTEGER,
          topic_style TEXT,
          is_promotional INTEGER NOT NULL DEFAULT 0,
          raw_json TEXT,
          UNIQUE(platform, source_id, external_id)
        );
        CREATE TABLE IF NOT EXISTS monitored_brands (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          keywords_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS brand_scan_channels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_id INTEGER NOT NULL,
          platform TEXT NOT NULL,
          identifier TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ad_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_id INTEGER NOT NULL,
          source_platform TEXT NOT NULL,
          source_identifier TEXT NOT NULL,
          post_external_id TEXT,
          sample_text TEXT,
          detected_at TEXT NOT NULL,
          published_at TEXT,
          views INTEGER,
          notified INTEGER NOT NULL DEFAULT 0,
          raw_json TEXT
        );
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const body = (await request.json()) as StoreRequest;
    try {
      switch (body.action) {
        case "getSession": {
          let stateJson: string | null = null;
          for (const row of this.sql.exec("SELECT state_json FROM user_states WHERE user_id = ?", body.userId)) {
            stateJson = row.state_json as string;
          }
          return Response.json({ session: stateJson });
        }
        case "putSession": {
          this.sql.exec(
            `INSERT INTO user_states (user_id, state_json, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
            body.userId,
            body.stateJson,
            body.updatedAt,
          );
          return Response.json({ ok: true });
        }
        case "listBrands": {
          const brands: Record<string, unknown>[] = [];
          for (const row of this.sql.exec(
            "SELECT id, owner_user_id, name, keywords_json FROM monitored_brands",
          )) {
            brands.push(row);
          }
          return Response.json({ brands });
        }
        case "createBrand": {
          this.sql.exec(
            "INSERT INTO monitored_brands (owner_user_id, name, keywords_json, created_at) VALUES (?, ?, ?, ?)",
            body.ownerUserId,
            body.name,
            body.keywordsJson,
            body.createdAt,
          );
          return Response.json({ ok: true });
        }
        case "listBrandChannels": {
          const channels: Record<string, unknown>[] = [];
          for (const row of this.sql.exec(
            "SELECT platform, identifier FROM brand_scan_channels WHERE brand_id = ?",
            body.brandId,
          )) {
            channels.push(row);
          }
          return Response.json({ channels });
        }
        case "cachePostsBatch": {
          for (const p of body.posts ?? []) {
            this.sql.exec(
              `INSERT OR REPLACE INTO posts (platform, source_id, external_id, published_at, format_type, caption, url, views, likes, comments, topic_style, is_promotional, raw_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              p.platform,
              p.sourceId,
              p.externalId,
              p.publishedAt,
              p.formatType,
              p.caption,
              p.url,
              p.views,
              p.likes,
              p.comments,
              p.topicStyle,
              p.isPromotional ? 1 : 0,
              p.rawJson,
            );
          }
          return Response.json({ ok: true, count: body.posts?.length ?? 0 });
        }
        default:
          return Response.json({ error: "unknown action" }, { status: 400 });
      }
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }
}

type StoreRequest =
  | { action: "getSession"; userId: string }
  | { action: "putSession"; userId: string; stateJson: string; updatedAt: string }
  | { action: "listBrands" }
  | { action: "createBrand"; ownerUserId: string; name: string; keywordsJson: string; createdAt: string }
  | { action: "listBrandChannels"; brandId: number }
  | {
      action: "cachePostsBatch";
      posts: {
        platform: string;
        sourceId: number;
        externalId: string;
        publishedAt: string;
        formatType: string;
        caption: string;
        url: string;
        views: number | null;
        likes: number | null;
        comments: number | null;
        topicStyle: string;
        isPromotional: boolean;
        rawJson: string;
      }[];
    };