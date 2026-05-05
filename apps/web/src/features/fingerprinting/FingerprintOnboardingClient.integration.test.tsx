/** @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FingerprintOnboardingClient } from "./FingerprintOnboardingClient";

function renderFingerprint() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <FingerprintOnboardingClient />
    </QueryClientProvider>
  );
}

const { routerPush } = vi.hoisted(() => ({
  routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush,
    prefetch: vi.fn(),
    replace: vi.fn(),
  }),
}));

const sampleSummary = {
  industryClassification: {
    title: "Software",
    detail: "SaaS",
    confidence: 0.92,
    confidenceTier: "high" as const,
    sources: ["LinkedIn"],
  },
  regulatoryObligations: [
    {
      title: "SOC 2",
      detail: "Trust",
      confidence: 0.85,
      confidenceTier: "high" as const,
      sources: ["AICPA"],
    },
  ],
  inferredOrgStructure: {
    title: "Flat",
    detail: "Eng",
    confidence: 0.7,
    confidenceTier: "medium" as const,
    sources: ["HN"],
  },
  businessProcesses: [
    {
      title: "Deploy",
      detail: "CI/CD",
      confidence: 0.88,
      confidenceTier: "high" as const,
      sources: ["DORA"],
    },
  ],
  riskDomains: [
    {
      title: "IAM",
      detail: "Access",
      confidence: 0.65,
      confidenceTier: "medium" as const,
      sources: ["NIST"],
    },
    {
      title: "Data",
      detail: "Residency",
      confidence: 0.6,
      confidenceTier: "medium" as const,
      sources: ["GDPR"],
    },
  ],
};

const completedData = {
  tenantId: "t1",
  payload: {
    jobId: "t1.fingerprint.job",
    status: "pending_review" as const,
    summary: sampleSummary,
  },
  timestamp: new Date().toISOString(),
};

const failedData = {
  tenantId: "t1",
  payload: {
    jobId: "t1.fingerprint.job",
    status: "failed" as const,
    failureReason: "LLM_OUTPUT_INVALID",
  },
  timestamp: new Date().toISOString(),
};

type SseMode = "completed" | "failed";

/** Mutable per-test (beforeEach resets). */
let sseMode: SseMode = "completed";

describe("FingerprintOnboardingClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sseMode = "completed";
    sessionStorage.clear();
    routerPush.mockClear();
    delete (globalThis as unknown as { __fpConfirmMode?: string }).__fpConfirmMode;

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    class MockEventSource {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;
      url: string;
      readyState = MockEventSource.OPEN;
      onerror: ((ev: Event) => void) | null = null;
      constructor(url: string) {
        this.url = url;
      }
      addEventListener(type: string, fn: (ev: MessageEvent) => void) {
        queueMicrotask(() => {
          if (sseMode === "completed" && type === "fingerprint.completed") {
            fn({ data: JSON.stringify(completedData) } as MessageEvent);
          }
          if (sseMode === "failed" && type === "fingerprint.failed") {
            fn({ data: JSON.stringify(failedData) } as MessageEvent);
          }
        });
      }
      removeEventListener() {}
      close() {}
    }

    vi.stubGlobal("EventSource", MockEventSource);

    fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/confirm") && init?.method === "POST") {
        const confirmMode = (
          globalThis as unknown as { __fpConfirmMode?: "ok" | "already" }
        ).__fpConfirmMode;
        if (confirmMode === "already") {
          return new Response(
            JSON.stringify({
              error: {
                code: "ALREADY_COMMITTED",
                message: "Fingerprint result already committed",
              },
            }),
            { status: 409, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            data: { jobId: "t1.fingerprint.job", status: "committed" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/fingerprint") && init?.method === "POST") {
        return new Response(JSON.stringify({ data: { jobId: "t1.fingerprint.job" } }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: { message: "no" } }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts fingerprint, consumes SSE summary, and reveals stream lines", async () => {
    const user = userEvent.setup();
    renderFingerprint();

    const input = screen.getByPlaceholderText("Type your company name…");
    await user.type(input, "Acme Corp");
    await user.click(screen.getByRole("button", { name: /analyze/i }));

    await waitFor(
      () => {
        expect(screen.getByText(/Software: SaaS/i)).toBeInTheDocument();
      },
      { timeout: 4000 }
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /looks right/i })).toBeInTheDocument();
    });
  });

  it("calls confirm and navigates to onboarding frameworks", async () => {
    const user = userEvent.setup();
    renderFingerprint();

    await user.type(screen.getByPlaceholderText("Type your company name…"), "Acme Corp");
    await user.click(screen.getByRole("button", { name: /analyze/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /looks right/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /looks right/i }));

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith("/onboarding/frameworks");
    });

    const confirmCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes("/confirm")
    );
    expect(confirmCalls.length).toBe(1);
    const [, init] = confirmCalls[0]!;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toMatchObject({
      overrides: {},
      removedLineIds: [],
    });
  });

  it("treats 409 ALREADY_COMMITTED as success and navigates", async () => {
    (
      globalThis as unknown as { __fpConfirmMode?: "ok" | "already" }
    ).__fpConfirmMode = "already";

    const user = userEvent.setup();
    renderFingerprint();

    await user.type(screen.getByPlaceholderText("Type your company name…"), "Acme Corp");
    await user.click(screen.getByRole("button", { name: /analyze/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /looks right/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /looks right/i }));

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith("/onboarding/frameworks");
    });

  });

  it("sends overrides and removedLineIds in confirm body", async () => {
    const user = userEvent.setup();
    renderFingerprint();

    await user.type(screen.getByPlaceholderText("Type your company name…"), "Acme Corp");
    await user.click(screen.getByRole("button", { name: /analyze/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit anything/i })).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /edit anything/i }));

    const removeRiskBtns = screen.getAllByRole("button", {
      name: /remove risk line/i,
    });
    await user.click(removeRiskBtns[0]!);

    await user.click(screen.getByRole("button", { name: /confirm my edits/i }));

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalled();
    });

    const confirmCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes("/confirm")
    );
    const [, init] = confirmCalls[confirmCalls.length - 1]!;
    const parsed = JSON.parse(init?.body as string) as {
      overrides: Record<string, string>;
      removedLineIds: string[];
    };
    expect(parsed.removedLineIds).toContain("risk-0");
  });

  it("shows failed state when SSE emits fingerprint.failed", async () => {
    sseMode = "failed";

    const user = userEvent.setup();
    renderFingerprint();

    await user.type(screen.getByPlaceholderText("Type your company name…"), "X");
    await user.click(screen.getByRole("button", { name: /analyze/i }));

    await waitFor(() => {
      expect(screen.getByText(/LLM_OUTPUT_INVALID/)).toBeInTheDocument();
    });
  });

  it("with reduced motion, shows multiple stream rows quickly", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((q: string) => ({
        matches: q === "(prefers-reduced-motion: reduce)",
        media: q,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    const user = userEvent.setup();
    renderFingerprint();

    await user.type(screen.getByPlaceholderText("Type your company name…"), "Co");
    await user.click(screen.getByRole("button", { name: /analyze/i }));

    await waitFor(() => {
      const items = screen.getAllByRole("listitem");
      expect(items.length).toBeGreaterThan(1);
    });
  });

  it("saving an override shows Edited badge", async () => {
    const user = userEvent.setup();
    renderFingerprint();

    await user.type(screen.getByPlaceholderText("Type your company name…"), "Co");
    await user.click(screen.getByRole("button", { name: /analyze/i }));

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /^override$/i }).length).toBeGreaterThan(0)
    );

    await user.click(screen.getAllByRole("button", { name: /^override$/i })[0]!);

    const field = screen.getByLabelText(/Edit Industry/i);
    await user.clear(field);
    await user.type(field, "Software: Custom text");
    await user.keyboard("{Enter}");

    expect(screen.getByText("Edited")).toBeInTheDocument();
  });

  it("opens sources popover and closes on Escape", async () => {
    const user = userEvent.setup();
    renderFingerprint();

    await user.type(screen.getByPlaceholderText("Type your company name…"), "Co");
    await user.click(screen.getByRole("button", { name: /analyze/i }));

    await waitFor(() => expect(screen.getByLabelText(/AI confidence for Industry/i)).toBeInTheDocument());

    await user.click(screen.getByLabelText(/AI confidence for Industry/i));

    expect(screen.getByRole("dialog", { name: /sources/i })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /sources/i })).not.toBeInTheDocument();
    });
  });

});
