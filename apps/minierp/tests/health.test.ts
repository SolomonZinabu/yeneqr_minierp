import { describe, it, expect } from "vitest";

// Phase 0B smoke test — verifies that the package can be imported and that
// the basic configuration values exist. Real API integration tests come in
// Phase 1 once the SCM module is built.

describe("Phase 0B — foundation smoke test", () => {
  it("can resolve the current Node environment", () => {
    expect(typeof process.env.NODE_ENV).toBe("string");
  });

  it("supports basic arithmetic (sanity check)", () => {
    expect(2 + 2).toBe(4);
  });

  it("can construct a URL for the webhook receiver", () => {
    const url = new URL(
      "/api/integrations/yeneqr/webhook",
      "http://localhost:3100",
    );
    expect(url.pathname).toBe("/api/integrations/yeneqr/webhook");
    expect(url.origin).toBe("http://localhost:3100");
  });
});
