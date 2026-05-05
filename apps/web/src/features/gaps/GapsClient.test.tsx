import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GapsClient } from "./GapsClient";

const gapsPayload = {
  data: {
    items: [
      {
        controlId: "c2",
        name: "Change management",
        domain: "Operations",
        status: "fail",
        frameworks: [{ key: "SOC2" as any, name: "SOC 2" }],
        assignedTo: null,
        dueDate: null,
        updatedAt: "2026-05-05T11:00:00Z",
      },
      {
        controlId: "c1",
        name: "Access review",
        domain: "Access Control",
        status: "warn",
        frameworks: [
          { key: "SOC2" as any, name: "SOC 2" },
          { key: "ISO27001" as any, name: "ISO 27001" },
        ],
        assignedTo: "user_2",
        dueDate: "2026-06-01",
        updatedAt: "2026-05-05T10:00:00Z",
      },
    ],
  },
};

describe("GapsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders warn/fail list sorted fail-first and exports CSV", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const gapsFetchCalls = { count: 0 };
    const eventSourceListeners: Record<string, Array<() => void>> = {};

    // @ts-expect-error test shim
    global.EventSource = vi.fn(() => ({
      addEventListener: (type: string, cb: () => void) => {
        eventSourceListeners[type] = eventSourceListeners[type] ?? [];
        eventSourceListeners[type]!.push(cb);
      },
      removeEventListener: () => {},
      close: () => {},
    }));

    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/v1/gaps")) {
        gapsFetchCalls.count += 1;
        return Promise.resolve({ ok: true, json: async () => gapsPayload } as Response);
      }
      if (url.includes("/api/v1/controls/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              id: "c2",
              name: "Change management",
              domain: "Operations",
              status: "fail",
              frameworkRefs: ["SOC2:CC8.1"],
              requirementDetails: [{ frameworkId: "SOC2", frameworkTitle: "SOC 2", code: "CC8.1" }],
              assignment: null,
              instructionRegenerated: false,
            },
          }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    const createObjectURL = vi.fn(() => "blob:csv");
    const revokeObjectURL = vi.fn();
    // @ts-expect-error test shim
    global.URL.createObjectURL = createObjectURL;
    // @ts-expect-error test shim
    global.URL.revokeObjectURL = revokeObjectURL;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <QueryClientProvider client={qc}>
        <GapsClient />
      </QueryClientProvider>
    );

    const rows = await screen.findAllByRole("row");
    // header + 2 rows
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const bodyRows = rows.slice(1);
    expect(within(bodyRows[0]!).getByText(/Change management/i)).toBeInTheDocument();
    expect(within(bodyRows[1]!).getByText(/Access review/i)).toBeInTheDocument();

    expect(gapsFetchCalls.count).toBeGreaterThanOrEqual(1);
    const passedHandler = eventSourceListeners["control.passed"]?.[0];
    expect(typeof passedHandler).toBe("function");
    passedHandler?.();
    await waitFor(() => expect(gapsFetchCalls.count).toBeGreaterThanOrEqual(2));

    await user.click(screen.getByRole("button", { name: /Export CSV/i }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /Change management\. Open details/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});

