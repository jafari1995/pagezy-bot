import type { Env } from "../env";
import type { UserSession } from "../types";

const STORE_NAME = "primary";

export async function storeRpc<T>(env: Env, body: Record<string, unknown>): Promise<T> {
  if (!env.PAGEZY_STORE) throw new Error("PAGEZY_STORE binding missing");
  const id = env.PAGEZY_STORE.idFromName(STORE_NAME);
  const stub = env.PAGEZY_STORE.get(id);
  const res = await stub.fetch("https://pagezy.store/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Store: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function loadSessionFromStore(env: Env, userId: string): Promise<UserSession> {
  const { session } = await storeRpc<{ session: string | null }>(env, {
    action: "getSession",
    userId,
  });
  if (!session) return { slots: {} };
  try {
    return JSON.parse(session) as UserSession;
  } catch {
    return { slots: {} };
  }
}

export async function saveSessionToStore(env: Env, userId: string, session: UserSession): Promise<void> {
  await storeRpc(env, {
    action: "putSession",
    userId,
    stateJson: JSON.stringify(session),
    updatedAt: new Date().toISOString(),
  });
}

export interface BrandRow {
  id: number;
  owner_user_id: string;
  name: string;
  keywords_json: string;
}

export async function listBrands(env: Env): Promise<BrandRow[]> {
  const { brands } = await storeRpc<{ brands: BrandRow[] }>(env, { action: "listBrands" });
  return brands ?? [];
}

export async function createBrand(
  env: Env,
  ownerUserId: string,
  name: string,
  keywords: string[],
): Promise<void> {
  await storeRpc(env, {
    action: "createBrand",
    ownerUserId,
    name,
    keywordsJson: JSON.stringify(keywords),
    createdAt: new Date().toISOString(),
  });
}

export async function listBrandChannels(
  env: Env,
  brandId: number,
): Promise<{ platform: string; identifier: string }[]> {
  const { channels } = await storeRpc<{ channels: { platform: string; identifier: string }[] }>(env, {
    action: "listBrandChannels",
    brandId,
  });
  return channels ?? [];
}