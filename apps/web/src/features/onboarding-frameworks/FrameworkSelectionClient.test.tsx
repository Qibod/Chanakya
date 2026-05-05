import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FrameworkSelectionClient } from "./FrameworkSelectionClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
}));

describe("FrameworkSelectionClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Starter preview copy", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          tier: "starter",
          maxSelectable: 1,
          recommended: ["SOC2"],
          frameworks: [
            {
              id: "SOC2",
              title: "SOC 2",
              shortDescription: "Trust criteria",
              controlCount: 5,
              estimatedGaps: 1,
              recommended: true,
              alreadyActivated: false,
            },
            {
              id: "GDPR",
              title: "GDPR",
              shortDescription: "Privacy",
              controlCount: 1,
              estimatedGaps: 1,
              recommended: false,
              alreadyActivated: false,
            },
          ],
        },
      }),
    } as Response);

    render(
      <QueryClientProvider client={qc}>
        <FrameworkSelectionClient />
      </QueryClientProvider>
    );

    expect(
      await screen.findByText(/Starter includes/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/SOC 2/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Preview — upgrade to activate/)).toBeInTheDocument();
  });
});
