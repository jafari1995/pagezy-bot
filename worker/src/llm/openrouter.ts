import { assertFreeModel, PAGEZY_SYSTEM_PROMPT_FA, type Env, isMock } from "../env";
import { getModelChain, shouldRotateModel } from "./models";

export class OpenRouterClient {
  constructor(private env: Env) {}

  async chat(userPrompt: string, maxTokens = 900): Promise<string> {
    if (isMock(this.env) || !this.env.OPENROUTER_API_KEY) {
      return mockResponse(userPrompt);
    }
    const models = await getModelChain(this.env);
    let lastErr: unknown;
    for (const model of models) {
      assertFreeModel(model);
      try {
        const { text, status } = await this.request(model, userPrompt, maxTokens);
        if (text) return text;
        if (shouldRotateModel(status)) continue;
      } catch (e) {
        lastErr = e;
        await sleep(600);
      }
    }
    throw new Error(`OpenRouter failed: ${lastErr ?? "no model"}`);
  }

  private async request(model: string, userPrompt: string, maxTokens: number): Promise<{ text: string; status: number }> {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pagezy.workers.dev",
        "X-Title": "Pagezy Analyst",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: PAGEZY_SYSTEM_PROMPT_FA },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      if (shouldRotateModel(res.status)) return { text: "", status: res.status };
      throw new Error(await res.text());
    }
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return { text: data.choices[0]?.message?.content?.trim() ?? "", status: res.status };
  }

  async classifyBatch(captions: string[]): Promise<string[]> {
    if (!captions.length) return [];
    if (isMock(this.env) || !this.env.OPENROUTER_API_KEY) {
      return captions.map(mockTopic);
    }
    const prompt = `برای هر caption یک برچسب موضوع/سبک کوتاه فارسی بده. فقط JSON array of strings.\n${JSON.stringify(captions)}`;
    const raw = await this.chat(prompt, 400);
    try {
      const m = raw.match(/\[[\s\S]*\]/);
      const arr = JSON.parse(m?.[0] ?? "[]") as string[];
      if (arr.length >= captions.length) return arr.slice(0, captions.length);
    } catch {
      /* fallthrough */
    }
    return captions.map(() => "نامشخص");
  }

  async parseConversationTurn(
    userText: string,
    slots: Record<string, unknown>,
  ): Promise<ConversationTurn> {
    if (isMock(this.env) || !this.env.OPENROUTER_API_KEY) {
      return mockConversationTurn(userText, slots);
    }
    const prompt = `تو orchestrator ربات تحلیل رقبای Pagezy هستی.
از پیام کاربر و اسلات‌های فعلی، JSON معتبر برگردان (بدون markdown):
{
  "reply_fa": "پاسخ فارسی",
  "slots": { platform?, identifier?, timeRange?: {kind, start?, end?}, brandName?, brandKeywords?, exportFormat?, zernioAccountId? },
  "action": null | "run_report" | "export" | "register_brand" | "answer_question" | "scan_ad_library",
  "question": "optional"
}
platform: telegram, instagram, youtube, zernio_connected
برای اینستاگرام رقیب: اگر کلید scraper نیست صادقانه بگو فقط حساب‌های متصل Zernio یا scraper optional در دسترس است.

اسلات: ${JSON.stringify(slots)}
پیام: ${userText}`;
    const raw = await this.chat(prompt, 700);
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      return JSON.parse(m?.[0] ?? "{}") as ConversationTurn;
    } catch {
      return { reply_fa: "لینک منبع و بازه را بفرستید.", slots, action: null };
    }
  }
}

export interface ConversationTurn {
  reply_fa: string;
  slots: Record<string, unknown>;
  action: null | "run_report" | "export" | "register_brand" | "answer_question" | "scan_ad_library";
  question?: string;
  exportFormat?: "xlsx" | "csv" | "pdf" | "txt";
}

function mockTopic(caption: string): string {
  if (/تبلیغ|تخفیف/.test(caption)) return "تبلیغ ابزار";
  if (/آموزش/.test(caption)) return "آموزشی";
  if (/تحلیل|خبر/.test(caption)) return "خبری/تحلیل";
  return "عمومی";
}

function mockResponse(prompt: string): string {
  if (prompt.includes("JSON array")) return '["آموزشی","تبلیغ ابزار","خبری/تحلیل"]';
  return "بر اساس داده‌ها، بیشترین بازدید مربوط به محتوای خبری/تحلیلی بود.";
}

function mockConversationTurn(userText: string, slots: Record<string, unknown>): ConversationTurn {
  const merged = { ...slots } as Record<string, unknown>;
  let action: ConversationTurn["action"] = null;
  if (/تحلیل|گزارش|کانال|اینستا|یوتیوب|تلگرام|t\.me|instagram|youtube/i.test(userText)) {
    if (/telegram|تلگرام|t\.me|@\w+/i.test(userText)) merged.platform = "telegram";
    else if (/instagram|اینستا/i.test(userText)) merged.platform = "instagram";
    else if (/youtube|یوتیوب/i.test(userText)) merged.platform = "youtube";
    const handle = userText.match(/(@[\w]+|t\.me\/[\w]+|instagram\.com\/[\w.]+|youtube\.com\/[^\s]+)/i)?.[0];
    if (handle) merged.identifier = handle;
    if (!merged.timeRange) merged.timeRange = { kind: "last_week" };
    if (merged.platform && merged.identifier) action = "run_report";
    else {
      return {
        reply_fa: "لینک یا @username منبع را بفرستید.",
        slots: merged,
        action: null,
      };
    }
  }
  if (/xlsx|csv|pdf|خروجی|اکسل/i.test(userText)) {
    const fmt = /pdf/i.test(userText) ? "pdf" : /csv/i.test(userText) ? "csv" : /xlsx|excel|اکسل/i.test(userText) ? "xlsx" : "txt";
    return { reply_fa: "در حال آماده‌سازی فایل…", slots: merged, action: "export", exportFormat: fmt };
  }
  if (/برند|رقیب|چراغ|تبلیغ.*اینستا|ad library/i.test(userText)) {
    merged.brandName = merged.brandName ?? userText.match(/برند\s+(\S+)/)?.[1] ?? "چراغ";
    return { reply_fa: `در حال جستجوی Ad Library برای «${merged.brandName}»…`, slots: merged, action: "scan_ad_library" };
  }
  return {
    reply_fa: action === "run_report" ? "باشه، دارم داده‌ها را جمع می‌کنم…" : "سلام! لینک رقیب و بازه را بفرستید.",
    slots: merged,
    action,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}