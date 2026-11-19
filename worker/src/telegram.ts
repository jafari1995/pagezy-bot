const API = (token: string) => `https://api.telegram.org/bot${token}`;

export async function tgSendMessage(token: string, chatId: number | string, text: string, extra?: Record<string, unknown>) {
  await tgCall(token, "sendMessage", { chat_id: chatId, text: text.slice(0, 4096), ...extra });
}

export async function tgSendDocument(
  token: string,
  chatId: number | string,
  filename: string,
  bytes: Uint8Array,
  caption?: string,
) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) form.append("caption", caption);
  form.append("document", new Blob([bytes]), filename);
  const res = await fetch(`${API(token)}/sendDocument`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`sendDocument: ${await res.text()}`);
}

export async function tgSetWebhook(token: string, url: string, secret?: string) {
  await tgCall(token, "setWebhook", { url, secret_token: secret, allowed_updates: ["message", "callback_query"] });
}

async function tgCall(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`${API(token)}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method}: ${await res.text()}`);
}

export function mainMenuKeyboard() {
  return {
    inline_keyboard: [[{ text: "تحلیل رقبا", callback_data: "competitor_analysis" }]],
  };
}