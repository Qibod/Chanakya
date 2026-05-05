import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { DashboardClient } from "./DashboardClient";

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("DashboardClient", () => {
  it("renders summary metrics and 8 domain cards from read model", async () => {
    const close = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();

    class MockEventSource {
      url: string;
      constructor(url: string) {
        this.url = url;
      }
      addEventListener = addEventListener;
      removeEventListener = removeEventListener;
      close = close;
    }

    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const reqUrl = String(input);
      if (reqUrl.includes("/api/v1/controls/c-1")) {
        return new Response(
          JSON.stringify({
            data: {
              id: "c-1",
              name: "AWS IAM access review",
              domain: "Access Control",
              status: "fail",
              frameworkRefs: ["SOC2:CC6.1"],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          data: {
            summary: {
              passing: 41,
              attention: 12,
              failing: 2,
              passingDeltaWeek: 3,
              trajectoryScore: null,
            },
            domains: Array.from({ length: 8 }).map((_v, i) => ({
              domain: `Domain ${i + 1}`,
              status: i === 0 ? "fail" : "pass",
              passRatePct: 80,
              controlCount: 10,
              topIssue:
                i === 0 ? { controlId: "c-1", controlName: "AWS IAM access review", status: "fail" } : null,
              sparkline30d: Array.from({ length: 30 }).map((_n, idx) => 70 + (idx % 3)),
            })),
            feed: [
              {
                id: "f1",
                severity: "fail",
                title: "Evidence stale: AWS IAM access review",
                meta: "2d ago · Control CC6.1",
                controlId: "c-1",
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }));

    renderWithQuery(<DashboardClient />);

    expect((await screen.findAllByText("Passing")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Needs attention")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Failing")).length).toBeGreaterThan(0);
    expect(screen.getByText("Trajectory")).toBeInTheDocument();

    const cards = await screen.findAllByText(/Domain \d+/);
    expect(cards).toHaveLength(8);

    expect(screen.getByText("Action feed")).toBeInTheDocument();
    expect(screen.getByText("Evidence stale: AWS IAM access review")).toBeInTheDocument();

    expect(addEventListener).toHaveBeenCalled();

    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "Fix now" })[0]!);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect((await screen.findAllByText("AWS IAM access review")).length).toBeGreaterThan(0);
  });
});

