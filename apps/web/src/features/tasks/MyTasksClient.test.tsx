import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MyTasksClient } from "./MyTasksClient";

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("MyTasksClient", () => {
  it("renders hero + cards and loads why-needed inline", async () => {
    const user = userEvent.setup();

    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/v1/my-tasks")) {
        return new Response(
          JSON.stringify({
            data: {
              summary: { taskCount: 1, automatedCount: 2 },
              tasks: [
                {
                  controlId: "c1",
                  assignmentId: "as1",
                  title: "Review: AWS IAM access review",
                  description: "Review the latest information and confirm everything looks correct.",
                  dueDate: "2026-06-01",
                  status: "todo",
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/api/v1/my-tasks/c1/why-needed") && (init as RequestInit)?.method === "POST") {
        return new Response(
          JSON.stringify({
            data: {
              text: "This keeps access accurate and reduces surprises later. It also creates a clear record of what you checked and when.",
              generatedAt: "2026-05-05T10:00:00.000Z",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: { message: `unexpected fetch: ${url}` } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    });

    renderWithQuery(<MyTasksClient />);

    expect(await screen.findByText(/You have 1 task to complete/i)).toBeInTheDocument();
    expect(screen.getByText(/2 controls are automated/i)).toBeInTheDocument();

    const cardTitle = screen.getByText(/Review: AWS IAM access review/i);
    expect(cardTitle).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Why is this needed/i }));
    expect(await screen.findByText(/keeps access accurate/i)).toBeInTheDocument();
  });

  it("completes a task and refreshes counts", async () => {
    const user = userEvent.setup();
    let completed = false;

    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/v1/my-tasks")) {
        return new Response(
          JSON.stringify({
            data: {
              summary: { taskCount: completed ? 0 : 1, automatedCount: 2 },
              tasks: [
                {
                  controlId: "c1",
                  assignmentId: "as1",
                  title: "Review: AWS IAM access review",
                  description: "Review the latest information and confirm everything looks correct.",
                  dueDate: null,
                  status: completed ? "complete" : "todo",
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/api/v1/my-tasks/c1/complete") && (init as RequestInit)?.method === "POST") {
        completed = true;
        return new Response(JSON.stringify({ data: { ok: true } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/api/v1/my-tasks/c1/why-needed") && (init as RequestInit)?.method === "POST") {
        return new Response(
          JSON.stringify({ data: { text: "Because.", generatedAt: "2026-05-05T10:00:00.000Z" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: { message: `unexpected fetch: ${url}` } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    });

    renderWithQuery(<MyTasksClient />);
    expect(await screen.findByText(/You have 1 task to complete/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Start review/i }));

    const note = await screen.findByLabelText(/Evidence note/i);
    await user.type(note, "Reviewed and confirmed.");

    await user.click(screen.getByRole("button", { name: /Submit evidence/i }));

    await waitFor(() =>
      expect(screen.getByText(/You're all clear\. No tasks assigned to you right now\./i)).toBeInTheDocument()
    );
  });
});

