import type { Env } from "../../env";

export const ZERNIO_API_BASE = "https://zernio.com/api/v1";

export async function zernioGet(
  env: Env,
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<Response> {
  if (!env.ZERNIO_API_KEY) throw new Error("ZERNIO_API_KEY تنظیم نشده.");
  const url = new URL(`${ZERNIO_API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${env.ZERNIO_API_KEY}`,
      Accept: "application/json",
    },
  });
}