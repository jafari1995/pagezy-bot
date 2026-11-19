import { describe, expect, it } from "vitest";
import { mapMediaType } from "./metaBusinessDiscovery";

describe("meta business discovery mapping", () => {
  it("maps REELS and carousel", () => {
    expect(mapMediaType("REELS", "VIDEO")).toBe("reel");
    expect(mapMediaType("FEED", "CAROUSEL_ALBUM")).toBe("carousel");
    expect(mapMediaType("FEED", "IMAGE")).toBe("single_image");
  });
});