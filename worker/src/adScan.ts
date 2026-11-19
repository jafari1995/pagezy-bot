import { collectPosts } from "./collectors";
import { detectPromotional } from "./analysis/promo";
import type { Env } from "./env";
import { isMock } from "./env";
import { tgSendMessage } from "./telegram";
import type { Platform } from "./types";

export async function scanBrandsCron(env: Env): Promise<void> {
  const brands = await env.DB.prepare("SELECT id, owner_user_id, name, keywords_json FROM monitored_brands").all<{
    id: number;
    owner_user_id: string;
    name: string;
    keywords_json: string;
  }>();

  for (const brand of brands.results ?? []) {
    const keywords: string[] = JSON.parse(brand.keywords_json || "[]");
    const channels = await env.DB.prepare(
      "SELECT platform, identifier FROM brand_scan_channels WHERE brand_id = ?",
    )
      .bind(brand.id)
      .all<{ platform: string; identifier: string }>();

    const chans = channels.results ?? [];
    if (!chans.length && isMock(env)) {
      await tgSendMessage(
        env.TELEGRAM_BOT_TOKEN,
        brand.owner_user_id,
        `🚨 نمونه هشدار (Mock) برای «${brand.name}»: mention چراغ + کد PAGEZY30`,
      );
      continue;
    }

    for (const ch of chans) {
      const posts = await collectPosts(env, ch.platform as Platform, ch.identifier, { kind: "last_week" });
      for (const p of posts) {
        if (!matchesBrand(p.caption, brand.name, keywords)) continue;
        const text =
          `🚨 اشاره/تبلیغ «${brand.name}»\nمنبع: ${ch.platform} ${ch.identifier}\nبازدید: ${p.views ?? "—"}\n\n${p.caption.slice(0, 1200)}`;
        await tgSendMessage(env.TELEGRAM_BOT_TOKEN, brand.owner_user_id, text);
      }
    }
  }
}

function matchesBrand(text: string, name: string, keywords: string[]): boolean {
  const t = text.toLowerCase();
  if (t.includes(name.toLowerCase())) return true;
  return keywords.some((k) => k && new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text));
}