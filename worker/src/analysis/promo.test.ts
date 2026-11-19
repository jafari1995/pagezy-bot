import { describe, expect, it } from "vitest";
import { detectPromotional } from "./promo";

describe("promo", () => {
  it("detects discount promos", () => {
    expect(detectPromotional("تخفیف ۳۰٪ کد PAGEZY30").isPromo).toBe(true);
  });
  it("allows news", () => {
    expect(detectPromotional("تحلیل خبر بازار").isPromo).toBe(false);
  });
});