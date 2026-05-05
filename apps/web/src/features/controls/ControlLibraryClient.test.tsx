import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ControlLibraryClient } from "./ControlLibraryClient";

const listPayload = {
  data: {
    total: 2,
    items: [
      {
        id: "a1",
        canonicalId: "c1",
        name: "Access",
        domain: "Access Control",
        status: "pending",
        framework: "SOC2",
        frameworkRefs: ["SOC2:CC6.1", "ISO27001:A.9.2.1"],
      },
      {
        id: "b1",
        canonicalId: "c2",
        name: "Change",
        domain: "Operations",
        status: "pending",
        framework: "SOC2",
        frameworkRefs: ["SOC2:CC8.1"],
      },
    ],
    nextCursor: null,
  },
};

const libraryPayload = {
  data: {
    tier: "growth",
    maxSelectable: 3,
    recommended: ["SOC2"],
    frameworks: [
      {
        id: "SOC2",
        title: "SOC 2",
        shortDescription: "",
        controlCount: 5,
        estimatedGaps: 1,
        recommended: true,
        alreadyActivated: true,
      },
      {
        id: "ISO27001",
        title: "ISO 27001",
        shortDescription: "",
        controlCount: 5,
        estimatedGaps: 1,
        recommended: false,
        alreadyActivated: true,
      },
    ],
  },
};

describe("ControlLibraryClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows shared count and framework scope; panel lists requirements", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/frameworks/library")) {
        return Promise.resolve({
          ok: true,
          json: async () => libraryPayload,
        } as Response);
      }
      if (url.includes("/controls?")) {
        return Promise.resolve({
          ok: true,
          json: async () => listPayload,
        } as Response);
      }
      if (url.includes("/api/v1/controls/a1")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              id: "a1",
              name: "Access",
              domain: "Access Control",
              status: "pending",
              frameworkRefs: ["SOC2:CC6.1", "ISO27001:A.9.2.1"],
              requirementDetails: [
                { frameworkId: "SOC2", frameworkTitle: "SOC 2", code: "CC6.1" },
                { frameworkId: "ISO27001", frameworkTitle: "ISO 27001", code: "A.9.2.1" },
              ],
            },
          }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    render(
      <QueryClientProvider client={qc}>
        <ControlLibraryClient />
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Shared controls/i)).toBeInTheDocument();
    expect(await screen.findByText(/Shared across frameworks/i)).toBeInTheDocument();

    await user.click(
      await screen.findByRole("button", { name: /Show controls mapped to ISO 27001/i })
    );
    expect(await screen.findByText(/Shared controls/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Open details for Access/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/CC6.1/)).toBeInTheDocument();
    expect(within(dialog).getByText(/one evidence upload/i)).toBeInTheDocument();
  });
});
