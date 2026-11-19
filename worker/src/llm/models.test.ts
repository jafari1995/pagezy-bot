import { describe, expect, it } from "vitest";
import { PREFERRED_FREE_ORDER } from "./models";
import { assertFreeModel } from "../env";

describe("openrouter models", () => {
  it("preferred chain uses current free ids", () => {
    expect(PREFERRED_FREE_ORDER[0]).toBe("google/gemma-4-31b-it:free");
    for (const id of PREFERRED_FREE_ORDER) assertFreeModel(id);
  });

  it("rejects paid models", () => {
    expect(() => assertFreeModel("openai/gpt-4o")).toThrow();
  });
});