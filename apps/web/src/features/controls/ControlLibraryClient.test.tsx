import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
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
        assignedTo: "user_123",
        updatedAt: "2026-05-05T10:00:00Z",
        framework: "SOC2",
        frameworkRefs: ["SOC2:CC6.1", "ISO27001:A.9.2.1"],
      },
      {
        id: "b1",
        canonicalId: "c2",
        name: "Change",
        domain: "Operations",
        status: "pending",
        assignedTo: null,
        updatedAt: "2026-05-05T11:00:00Z",
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
    window.sessionStorage.clear();
  });

  async function findRowButton(name: string) {
    return await screen.findByRole("button", { name: new RegExp(`^${name}\\.`, "i") });
  }

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

    await user.click(await findRowButton("Access"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/CC6.1/)).toBeInTheDocument();
    expect(within(dialog).getByText(/one evidence upload/i)).toBeInTheDocument();
  });

  it("renders assigned owner and last-updated metadata from list payload", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/frameworks/library")) {
        return Promise.resolve({ ok: true, json: async () => libraryPayload } as Response);
      }
      if (url.includes("/controls?")) {
        return Promise.resolve({ ok: true, json: async () => listPayload } as Response);
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

    expect(await findRowButton("Access")).toBeInTheDocument();
    expect((await screen.findAllByText(/Unassigned/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Last updated/i)).length).toBeGreaterThan(0);
  });

  it("groups controls by domain and supports collapsing a domain section", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/frameworks/library")) {
        return Promise.resolve({ ok: true, json: async () => libraryPayload } as Response);
      }
      if (url.includes("/controls?")) {
        return Promise.resolve({ ok: true, json: async () => listPayload } as Response);
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
              requirementDetails: [],
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

    const accessDomain = await screen.findByRole("button", { name: /Access Control/i });
    const opsDomain = await screen.findByRole("button", { name: /Operations/i });
    expect(accessDomain).toBeInTheDocument();
    expect(opsDomain).toBeInTheDocument();

    expect(await findRowButton("Access")).toBeInTheDocument();
    expect(await findRowButton("Change")).toBeInTheDocument();

    await user.click(accessDomain);
    expect(screen.queryByRole("button", { name: /^Access\./i })).not.toBeInTheDocument();
    expect(await findRowButton("Change")).toBeInTheDocument();
  });

  it("applies AND logic across framework + status + owner filters and supports Clear all", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/frameworks/library")) {
        return Promise.resolve({ ok: true, json: async () => libraryPayload } as Response);
      }
      if (url.includes("/controls?")) {
        return Promise.resolve({ ok: true, json: async () => listPayload } as Response);
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
              requirementDetails: [],
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

    expect(await findRowButton("Access")).toBeInTheDocument();
    expect(await findRowButton("Change")).toBeInTheDocument();

    // Apply owner=Unassigned AND framework=ISO27001, which should produce zero results.
    await user.click(screen.getByRole("button", { name: /Show unassigned controls/i }));
    await user.click(screen.getByRole("button", { name: /Show controls mapped to ISO 27001/i }));

    expect(await screen.findByText(/No controls in this view/i)).toBeInTheDocument();

    // Clear all should restore full list.
    await user.click(screen.getByRole("button", { name: /Clear all/i }));
    expect(await findRowButton("Access")).toBeInTheDocument();
    expect(await findRowButton("Change")).toBeInTheDocument();
  });

  it("closes the panel on Escape and restores focus to the triggering row", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/frameworks/library")) {
        return Promise.resolve({ ok: true, json: async () => libraryPayload } as Response);
      }
      if (url.includes("/controls?")) {
        return Promise.resolve({ ok: true, json: async () => listPayload } as Response);
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

    const trigger = await findRowButton("Access");
    trigger.focus();
    await user.click(trigger);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(
      () => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      { timeout: 500 }
    );
    expect(trigger).toHaveFocus();
  });

  it("opens Assign modal from side panel and saves assignment", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    vi.spyOn(global, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes("/frameworks/library")) {
        return Promise.resolve({ ok: true, json: async () => libraryPayload } as Response);
      }
      if (url.includes("/controls?")) {
        return Promise.resolve({ ok: true, json: async () => listPayload } as Response);
      }
      if (url.includes("/api/v1/controls/a1") && (!init || (init as RequestInit).method === undefined)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              id: "a1",
              name: "Access",
              domain: "Access Control",
              status: "pending",
              frameworkRefs: ["SOC2:CC6.1", "ISO27001:A.9.2.1"],
              requirementDetails: [],
              assignment: null,
              instructionRegenerated: false,
            },
          }),
        } as Response);
      }
      if (url.includes("/api/v1/users")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              { id: "user_2", email: "owner@example.com", name: "Owner", active: true, role: "ControlOwner" },
            ],
            pagination: { limit: 50, offset: 0, total: 1 },
          }),
        } as Response);
      }
      if (url.includes("/api/v1/controls/a1/assign") && (init as RequestInit)?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              id: "a1",
              assignedTo: "user_2",
              dueDate: "2026-06-01",
              status: "in_review",
              instruction: "Step 1\nStep 2",
              instructionUpdatedAt: "2026-05-05T10:00:00.000Z",
              integrationsUsed: ["aws"],
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

    const trigger = await findRowButton("Access");
    await user.click(trigger);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Assign" }));
    const modal = await screen.findByRole("dialog", { name: /assign control/i });
    expect(modal).toBeInTheDocument();

    await user.selectOptions(within(modal).getByLabelText(/owner/i), "user_2");
    await user.type(within(modal).getByLabelText(/due date/i), "2026-06-01");

    const save = within(modal).getByRole("button", { name: /save assignment/i });
    await user.click(save);

    await waitFor(() => expect(screen.queryByRole("dialog", { name: /assign control/i })).not.toBeInTheDocument());
  });

  it("closes Assign modal on Escape and restores focus", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/frameworks/library")) {
        return Promise.resolve({ ok: true, json: async () => libraryPayload } as Response);
      }
      if (url.includes("/controls?")) {
        return Promise.resolve({ ok: true, json: async () => listPayload } as Response);
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
              requirementDetails: [],
              assignment: null,
              instructionRegenerated: false,
            },
          }),
        } as Response);
      }
      if (url.includes("/api/v1/users")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [], pagination: { limit: 50, offset: 0, total: 0 } }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    render(
      <QueryClientProvider client={qc}>
        <ControlLibraryClient />
      </QueryClientProvider>
    );

    const row = await findRowButton("Access");
    await user.click(row);
    const assignBtn = screen.getByRole("button", { name: "Assign" });
    assignBtn.focus();
    await user.click(assignBtn);

    expect(await screen.findByRole("dialog", { name: /assign control/i })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /assign control/i })).not.toBeInTheDocument()
    );
    expect(assignBtn).toHaveFocus();
  });
});
