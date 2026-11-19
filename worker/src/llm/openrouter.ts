import { assertFreeModel, FREE_MODELS, PAGEZY_SYSTEM_PROMPT_FA, type Env, isMock } from "../env";

export class OpenRouterClient {
  constructor(private env: Env) {}

  private models(): string[] {
    const list = [...FREE_MODELS];
    if (this.env.OPENROUTER_MODEL) {
      assertFreeModel(this.env.OPENROUTER_MODEL);
      if (!list.includes(this.env.OPENROUTER_MODEL)) list.unshift(this.env.OPENROUTER_MODEL);
    }
    return list;
  }

  async chat(userPrompt: string, maxTokens = 900): Promise<string> {
    if (isMock(this.env) || !this.env.OPENROUTER_API_KEY) {
      return mockResponse(userPrompt);
    }
    let lastErr: unknown;
    for (const model of this.models()) {
      try {
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
        if (res.status === 429) {
          await sleep(2000);
          continue;
        }
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { choices: { message: { content: string } }[] };
        return data.choices[0]?.message?.content?.trim() ?? "";
      } catch (e) {
        lastErr = e;
        await sleep(800);
      }
    }
    throw new Error(`OpenRouter failed: ${lastErr}`);
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
  "reply_fa": "پاسخ فارسی به کاربر",
  "slots": { platform?, identifier?, timeRange?: {kind, start?, end?}, brandName?, brandKeywords?, exportFormat? },
  "action": null | "run_report" | "export" | "register_brand" | "answer_question",
  "question": "optional if answer_question"
}
kind values: last_week, last_month, all, custom
platform: telegram, instagram, youtube

اسلات فعلی: ${JSON.stringify(slots)}
پیام کاربر: ${userText}`;
    const raw = await this.chat(prompt, 700);
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      return JSON.parse(m?.[0] ?? "{}") as ConversationTurn;
    } catch {
      return { reply_fa: "متوجه نشدم؛ لینک کانال یا پیج و بازه زمانی را بفرستید.", slots, action: null };
    }
  }
}

export interface ConversationTurn {
  reply_fa: string;
  slots: Record<string, unknown>;
  action: null | "run_report" | "export" | "register_brand" | "answer_question";
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
        reply_fa: "لینک یا @username منبع را بفرستید (مثلاً @channel یا لینک یوتیوب). بازه را هم بگویید: هفته گذشته، ماه گذشته، یا همه.",
        slots: merged,
        action: null,
      };
    }
  }
  if (/xlsx|csv|pdf|خروجی|اکسل/i.test(userText)) {
    const fmt = /pdf/i.test(userText) ? "pdf" : /csv/i.test(userText) ? "csv" : /xlsx|excel|اکسل/i.test(userText) ? "xlsx" : "txt";
    return { reply_fa: "در حال آماده‌سازی فایل…", slots: merged, action: "export", exportFormat: fmt };
  }
  if (/برند|رقیب|چراغ|مانیتور/i.test(userText)) {
    merged.brandName = merged.brandName ?? userText.match(/برند\s+(\S+)/)?.[1] ?? "چراغ";
    merged.brandKeywords = [String(merged.brandName), "تخفیف", "PAGEZY"];
    return { reply_fa: `برند «${merged.brandName}» ثبت شد؛ اسکن دوره‌ای فعال است.`, slots: merged, action: "register_brand" };
  }
  return {
    reply_fa: action === "run_report" ? "باشه، دارم داده‌ها را جمع می‌کنم…" : "سلام! لینک رقیب (تلگرام/اینستا/یوتیوب) و بازه زمانی را بفرستید.",
    slots: merged,
    action,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}