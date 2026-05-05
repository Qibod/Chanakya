import { describe, expect, it } from "vitest";
import { FINGERPRINT_LINE_STAGGER_MS } from "./fingerprint-constants";

describe("fingerprint-constants", () => {
  it("uses 40ms stagger per UX / Story 2.2", () => {
    expect(FINGERPRINT_LINE_STAGGER_MS).toBe(40);
  });
});
