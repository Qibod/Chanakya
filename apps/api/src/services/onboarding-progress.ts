import { prisma } from "@grc/db";

type StepFlags = {
  fingerprint: boolean;
  framework: boolean;
  integration: boolean;
  assign_control: boolean;
  first_report: boolean;
};

export async function computeOnboardingSteps(
  schema: string,
  tenantId: string
): Promise<{ steps: StepFlags; completedCount: number; allComplete: boolean }> {
  const [meta, fp, fw, integ, assign] = await Promise.all([
    prisma.$queryRawUnsafe<
      Array<{ onboarding_first_report_completed_at: Date | null }>
    >(
      `SELECT onboarding_first_report_completed_at FROM "${schema}".tenants WHERE id = $1 LIMIT 1`,
      tenantId
    ),
    prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
      `SELECT EXISTS (
         SELECT 1 FROM "${schema}".fingerprint_results WHERE status = 'committed' LIMIT 1
       ) AS ok`
    ),
    prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
      `SELECT EXISTS (SELECT 1 FROM "${schema}".framework_activations LIMIT 1) AS ok`
    ),
    prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
      `SELECT EXISTS (
         SELECT 1 FROM "${schema}".integration_configs WHERE status = 'connected' LIMIT 1
       ) AS ok`
    ),
    prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
      `SELECT EXISTS (
         SELECT 1 FROM "${schema}".control_items WHERE assigned_to IS NOT NULL LIMIT 1
       ) AS ok`
    ),
  ]);

  const firstReportDone = meta[0]?.onboarding_first_report_completed_at != null;

  const steps: StepFlags = {
    fingerprint: Boolean(fp[0]?.ok),
    framework: Boolean(fw[0]?.ok),
    integration: Boolean(integ[0]?.ok),
    assign_control: Boolean(assign[0]?.ok),
    first_report: firstReportDone,
  };

  const completedCount = Object.values(steps).filter(Boolean).length;
  return { steps, completedCount, allComplete: completedCount === 5 };
}

/** Sets onboarding_dismissed_at when all five onboarding steps are satisfied (tenant-level). */
export async function finalizeDismissIfComplete(
  schema: string,
  tenantId: string
): Promise<void> {
  const progress = await computeOnboardingSteps(schema, tenantId);
  if (!progress.allComplete) return;
  await prisma.$executeRawUnsafe(
    `UPDATE "${schema}".tenants
     SET onboarding_dismissed_at = COALESCE(onboarding_dismissed_at, NOW()),
         updated_at = NOW()
     WHERE id = $1`,
    tenantId
  );
}
