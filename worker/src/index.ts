import { handleTelegramUpdate } from "./conversation";
import type { Env } from "./env";
import { isMock } from "./env";

export { MtprotoCollector } from "./mtproto/MtprotoCollector";
export { PagezyStore } from "./storage/PagezyStore";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, mock: isMock(env) });
    }

    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      if (env.TELEGRAM_WEBHOOK_SECRET) {
        const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
        if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
          return new Response("forbidden", { status: 403 });
        }
      }
      const update = (await request.json()) as Record<string, unknown>;
      ctx.waitUntil(handleTelegramUpdate(env, update));
      return new Response("ok");
    }

    if (url.pathname === "/mock/e2e" && isMock(env)) {
      const { runMockE2E } = await import("./mockE2e");
      const result = await runMockE2E(env);
      return Response.json(result);
    }

    return new Response("Pagezy Analyst Worker", { status: 200 });
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduledJobs(env));
  },
};

async function runScheduledJobs(env: Env): Promise<void> {
  const { probeZernioBusinessDiscovery } = await import("./collectors/zernio/businessDiscovery");
  await probeZernioBusinessDiscovery(env);
  const { refreshFreeModels } = await import("./llm/models");
  await refreshFreeModels(env);
  if (!env.TELEGRAM_BOT_TOKEN) return;
  const { scanBrandsCron } = await import("./adScan");
  await scanBrandsCron(env);
}