import { assertFreeModel, type Env, isMock } from "../env";

export const KV_FREE_MODELS_KEY = "openrouter:free_models";
export const KV_FREE_MODELS_TS = "openrouter:free_models:ts";

/** Persian-friendly chain: multilingual first, then strong, then fast fallback. */
export const PREFERRED_FREE_ORDER = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "baidu/ernie-5.5-flash-preview:free",
  "inclusionai/ling-3.2-flash:free",
  "nvidia/nemotron-3.5-super-vl:free",
];

const HARD_MINIMAL_FALLBACK = [...PREFERRED_FREE_ORDER];

export async function getModelChain(env: Env): Promise<string[]> {
  if (isMock(env)) return HARD_MINIMAL_FALLBACK;
  const cached = await env.CACHE.get(KV_FREE_MODELS_KEY, "json");
  if (Array.isArray(cached) && cached.length) {
    return cached as string[];
  }
  await refreshFreeModels(env);
  const after = await env.CACHE.get(KV_FREE_MODELS_KEY, "json");
  if (Array.isArray(after) && after.length) return after as string[];
  return HARD_MINIMAL_FALLBACK;
}

export async function refreshFreeModels(env: Env): Promise<string[]> {
  let live: string[] = [];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: env.OPENROUTER_API_KEY ? { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` } : {},
    });
    if (res.ok) {
      const body = (await res.json()) as { data?: { id: string }[] };
      live = (body.data ?? []).map((m) => m.id).filter((id) => id.endsWith(":free"));
    }
  } catch {
    /* use preferred only */
  }

  const liveSet = new Set(live);
  const chain: string[] = [];
  for (const id of PREFERRED_FREE_ORDER) {
    if (!live.length || liveSet.has(id)) {
      assertFreeModel(id);
      chain.push(id);
    }
  }
  for (const id of live) {
    if (!chain.includes(id)) {
      assertFreeModel(id);
      chain.push(id);
    }
  }
  if (!chain.length) chain.push(...HARD_MINIMAL_FALLBACK);

  await env.CACHE.put(KV_FREE_MODELS_KEY, JSON.stringify(chain), { expirationTtl: 60 * 60 * 6 });
  await env.CACHE.put(KV_FREE_MODELS_TS, new Date().toISOString(), { expirationTtl: 60 * 60 * 6 });
  return chain;
}

export function shouldRotateModel(status: number): boolean {
  return status === 404 || status === 429 || status >= 500;
}