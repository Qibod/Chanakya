import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@grc/db", () => {
  const prismaMock = {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  };
  return { prisma: prismaMock };
});

import { prisma } from "@grc/db";
import { computeOnboardingSteps, finalizeDismissIfComplete } from "./onboarding-progress.js";

const SCHEMA = "tenant_test";
const TENANT_ID = "tenant_1";

describe("onboarding-progress service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("derives all-false matrix", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      // meta: first_report timestamp
      .mockResolvedValueOnce([{ onboarding_first_report_completed_at: null }] as never)
      // fingerprint
      .mockResolvedValueOnce([{ ok: false }] as never)
      // framework
      .mockResolvedValueOnce([{ ok: false }] as never)
      // integration
      .mockResolvedValueOnce([{ ok: false }] as never)
      // assign_control
      .mockResolvedValueOnce([{ ok: false }] as never);

    const r = await computeOnboardingSteps(SCHEMA, TENANT_ID);
    expect(r.steps).toEqual({
      fingerprint: false,
      framework: false,
      integration: false,
      assign_control: false,
      first_report: false,
    });
    expect(r.completedCount).toBe(0);
    expect(r.allComplete).toBe(false);
  });

  it("derives all-true matrix", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([{ onboarding_first_report_completed_at: new Date() }] as never)
      .mockResolvedValueOnce([{ ok: true }] as never)
      .mockResolvedValueOnce([{ ok: true }] as never)
      .mockResolvedValueOnce([{ ok: true }] as never)
      .mockResolvedValueOnce([{ ok: true }] as never);

    const r = await computeOnboardingSteps(SCHEMA, TENANT_ID);
    expect(r.completedCount).toBe(5);
    expect(r.allComplete).toBe(true);
  });

  it("finalizeDismissIfComplete is a no-op when incomplete", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([{ onboarding_first_report_completed_at: null }] as never)
      .mockResolvedValueOnce([{ ok: true }] as never) // fp
      .mockResolvedValueOnce([{ ok: true }] as never) // fw
      .mockResolvedValueOnce([{ ok: true }] as never) // integ
      .mockResolvedValueOnce([{ ok: false }] as never); // assign

    await finalizeDismissIfComplete(SCHEMA, TENANT_ID);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("finalizeDismissIfComplete writes with COALESCE when complete", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([{ onboarding_first_report_completed_at: new Date() }] as never)
      .mockResolvedValueOnce([{ ok: true }] as never)
      .mockResolvedValueOnce([{ ok: true }] as never)
      .mockResolvedValueOnce([{ ok: true }] as never)
      .mockResolvedValueOnce([{ ok: true }] as never);

    await finalizeDismissIfComplete(SCHEMA, TENANT_ID);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    const sql = vi.mocked(prisma.$executeRawUnsafe).mock.calls[0]?.[0] as string;
    expect(sql).toContain("COALESCE(onboarding_dismissed_at, NOW())");
  });
});

