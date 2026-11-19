/** Owner-connected Instagram (Alsafari / @alsafaridev7) */
export const DEFAULT_ZERNIO_INSTAGRAM_ACCOUNT_ID = "6af6e7b664a67632e57fced8";

export function resolvedZernioInstagramAccountId(env: { ZERNIO_INSTAGRAM_ACCOUNT_ID?: string }): string {
  return env.ZERNIO_INSTAGRAM_ACCOUNT_ID?.trim() || DEFAULT_ZERNIO_INSTAGRAM_ACCOUNT_ID;
}