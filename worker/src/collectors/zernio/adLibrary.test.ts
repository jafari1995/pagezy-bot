import { describe, expect, it } from "vitest";
import { formatAdLibraryAlertFa } from "./adLibrary";

describe("ad library format", () => {
  it("formats hits in Persian", () => {
    const text = formatAdLibraryAlertFa("چراغ", [
      { platform: "meta", text: "تخفیف SEO", advertiser: "Cheragh", raw: {} },
    ]);
    expect(text).toContain("چراغ");
    expect(text).toContain("تخفیف");
  });
});