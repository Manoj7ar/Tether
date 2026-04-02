import { describe, expect, it } from "vitest";
import { getErrorMessage } from "@/lib/error-utils";

describe("getErrorMessage", () => {
  it("returns an Error message", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns a string error", () => {
    expect(getErrorMessage("plain error")).toBe("plain error");
  });

  it("falls back for unknown values", () => {
    expect(getErrorMessage({})).toBe("Something went wrong");
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
  });
});
