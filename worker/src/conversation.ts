import type { Env } from "./env";
import { allowedUsers, isMock } from "./env";
import { buildExport } from "./export";
import { OpenRouterClient } from "./llm/openrouter";
import { answerOnReport, runReport } from "./pipeline";
import { loadSession, saveSession } from "./session";
import { mainMenuKeyboard, tgSendDocument, tgSendMessage } from "./telegram";
import type { ConversationSlots, Platform, TimeRange, UserSession } from "./types";

export async function handleTelegramUpdate(env: Env, update: Record<string, unknown>): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  if (update.callback_query) {
    const cq = update.callback_query as { id: string; data?: string; from: { id: number }; message?: { chat: { id: number } } };
    const userId = String(cq.from.id);
    if (!isAllowed(env, userId)) return;
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: cq.id }),
    });
    if (cq.data === "competitor_analysis") {
      const session = await loadSession(env, userId);
      session.slots.awaiting = "source";
      await saveSession(env, userId, session);
      await tgSendMessage(
        token,
        cq.message?.chat.id ?? cq.from.id,
        "عالی 👋 لینک یا @username کانال تلگرام، پیج اینستا، یا کانال یوتیوب را بفرستید.\nبازه را هم بگویید (هفته گذشته / ماه گذشته / همه).",
      );
    }
    return;
  }

  const msg = update.message as { chat: { id: number }; from?: { id: number }; text?: string } | undefined;
  if (!msg?.text || !msg.from) return;
  const userId = String(msg.from.id);
  if (!isAllowed(env, userId)) {
    await tgSendMessage(token, msg.chat.id, "⛔ دسترسی فقط برای مالک Pagezy (ALLOWED_USER_IDS).");
    return;
  }

  const text = msg.text.trim();
  if (text === "/start" || text === "/menu") {
    await tgSendMessage(token, msg.chat.id, "دستیار تحلیل Pagezy — از دکمه شروع کنید یا مستقیم لینک رقیب را بفرستید.", {
      reply_markup: mainMenuKeyboard(),
    });
    return;
  }

  const session = await loadSession(env, userId);
  const llm = new OpenRouterClient(env);
  const turn = await llm.parseConversationTurn(text, session.slots as Record<string, unknown>);
  session.slots = mergeSlots(session.slots, turn.slots);
  let reply = turn.reply_fa;

  if (turn.action === "run_report" && session.slots.platform && session.slots.identifier) {
    reply = "⏳ دارم داده‌ها را جمع و تحلیل می‌کنم…";
    await tgSendMessage(token, msg.chat.id, reply);
    try {
      const range = (session.slots.timeRange ?? { kind: "last_week" }) as TimeRange;
      const report = await runReport(
        env,
        session.slots.platform as Platform,
        session.slots.identifier,
        range,
      );
      session.lastReport = report;
      session.slots.awaiting = undefined;
      await saveSession(env, userId, session);
      await tgSendMessage(token, msg.chat.id, report.summaryText);
      await tgSendMessage(
        token,
        msg.chat.id,
        "اگر خروجی فایل می‌خواهید بگویید: xlsx، csv، pdf یا txt. سوال آزاد هم بپرسید.",
      );
      return;
    } catch (e) {
      await tgSendMessage(token, msg.chat.id, `خطا: ${e instanceof Error ? e.message : e}`);
      return;
    }
  }

  if (turn.action === "export" && session.lastReport) {
    const fmt = turn.exportFormat ?? session.slots.exportFormat ?? "xlsx";
    const file = await buildExport(fmt, session.lastReport);
    await tgSendDocument(token, msg.chat.id, file.filename, file.bytes, `خروجی ${fmt}`);
    await saveSession(env, userId, session);
    return;
  }

  if (turn.action === "scan_ad_library") {
    const brand = String(session.slots.brandName ?? text.replace(/.*برند\s*/i, "").trim() || "چراغ");
    const { scanAdLibraryForBrand } = await import("./adScan");
    await scanAdLibraryForBrand(env, brand, msg.chat.id);
    await saveSession(env, userId, session);
    return;
  }

  if (turn.action === "register_brand" && session.slots.brandName) {
    const kws = session.slots.brandKeywords ?? [session.slots.brandName];
    await env.DB.prepare(
      "INSERT INTO monitored_brands (owner_user_id, name, keywords_json, created_at) VALUES (?, ?, ?, ?)",
    )
      .bind(userId, session.slots.brandName, JSON.stringify(kws), new Date().toISOString())
      .run();
    reply = `برند «${session.slots.brandName}» ذخیره شد. برای تنظیم کانال‌های اسکن در پیام بعدی @channel بدهید.`;
  }

  if (turn.action === "answer_question" && session.lastReport) {
    reply = await answerOnReport(env, turn.question ?? text, session.lastReport);
  }

  await saveSession(env, userId, session);
  await tgSendMessage(token, msg.chat.id, reply, { reply_markup: mainMenuKeyboard() });
}

function isAllowed(env: Env, userId: string): boolean {
  const ids = allowedUsers(env);
  if (isMock(env) && ids.size === 0) return true;
  return ids.has(userId);
}

function mergeSlots(current: ConversationSlots, patch: Record<string, unknown>): ConversationSlots {
  return { ...current, ...(patch as ConversationSlots) };
}