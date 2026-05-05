import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock next/navigation redirect to throw (Next does this internally).
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    const err = new Error(`REDIRECT:${to}`);
    (err as any).digest = "NEXT_REDIRECT";
    throw err;
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "user_1" }),
}));

vi.mock("next/headers", () => ({
  headers: async () =>
    new Map<string, string>([
      ["host", "localhost:3000"],
      ["cookie", "cookie=1"],
    ]),
}));

describe("/my-tasks page", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("redirects non-ControlOwner users to /dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ role: "AuditDirector" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
    );

    const mod = await import("./page");
    await expect(Promise.resolve().then(() => mod.default())).rejects.toThrowError("REDIRECT:/dashboard");
  });

  it("allows ControlOwner users to render the page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ role: "ControlOwner" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
    );

    const mod = await import("./page");
    await expect(Promise.resolve().then(() => mod.default())).resolves.toBeTruthy();
  });
});

