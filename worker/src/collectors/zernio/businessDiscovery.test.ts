import { describe, expect, it } from "vitest";
import { mapZernioMedia, type ZernioMediaItem, type ZernioProfile } from "./businessDiscovery";

describe("zernio business discovery mapper", () => {
  const profile: ZernioProfile = {
    id: "178414",
    username: "competitor",
    followersCount: 1000,
    mediaCount: 10,
  };

  it("maps live API shape (camelCase)", () => {
    const m: ZernioMediaItem = {
      id: "123",
      caption: "تست",
      mediaType: "VIDEO",
      mediaProductType: "REELS",
      timestamp: "2026-01-01T12:00:00Z",
      permalink: "https://instagram.com/p/x",
      likeCount: 10,
      commentsCount: 2,
      viewCount: 500,
      mediaUrl: "https://cdn.example/v.mp4",
      thumbnailUrl: "https://cdn.example/t.jpg",
    };
    const post = mapZernioMedia(m, profile);
    expect(post.formatType).toBe("reel");
    expect(post.views).toBe(500);
    expect(post.likes).toBe(10);
    expect(post.raw?.competitorUsername).toBe("competitor");
  });

  it("null viewCount on feed image", () => {
    const m: ZernioMediaItem = {
      id: "1",
      mediaType: "IMAGE",
      mediaProductType: "FEED",
      likeCount: 3,
      commentsCount: 1,
      viewCount: null,
    };
    expect(mapZernioMedia(m).views).toBeNull();
    expect(mapZernioMedia(m).formatType).toBe("single_image");
  });
});