import type { FastifyInstance } from "fastify";
import { prisma } from "@grc/db";
import { requireRole, requireTier } from "../../middleware/rbac.js";
import { ensureTenantSchemaNameOrReply } from "../../lib/tenant-schema.js";
import { redis } from "../../plugins/redis.js";

const dashboardPreHandlers = [requireTier("starter"), requireRole("AuditDirector")];

const DASHBOARD_CACHE_PREFIX = "grc:dashboard:";
const DASHBOARD_CACHE_TTL_SEC = 30;

type ControlRow = { id: string; name: string; domain: string; status: string; updatedAt?: string | Date | null };
type ControlSummaryRow = { id: string; domain: string; status: string };

type ControlSnapshotRow = { control_id: string; status: string; recorded_at: Date | string };
type DayPoint = { endMs: number; idx: number };

function toDomainStatus(status: string): "pass" | "warn" | "fail" | "pending" {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "fail") return "fail";
  if (normalized === "warn") return "warn";
  if (normalized === "pass" || normalized === "auto") return "pass";
  return "pending";
}

function domainCardStatus(failing: number, attention: number, total: number): "pass" | "warn" | "fail" | "pending" {
  if (total === 0) return "pending";
  if (failing > 0) return "fail";
  if (attention > 0) return "warn";
  return "pass";
}

function statusIsPassing(status: string): boolean {
  const normalized = String(status ?? "").toLowerCase();
  return normalized === "pass" || normalized === "auto";
}

function mapSnapshotStatusToPass(status: string): boolean {
  // Snapshot table records only: pass | warn | fail
  return status === "pass";
}

function buildDayPoints(nowMs: number): DayPoint[] {
  const start = new Date(nowMs);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 29); // 30 days including today
  const dayMs = 24 * 60 * 60 * 1000;

  return Array.from({ length: 30 }).map((_, idx) => {
    const endMs = start.getTime() + (idx + 1) * dayMs - 1;
    return { endMs, idx };
  });
}

function computeSparkline30d({
  controlIds,
  currentStatusByControlId,
  snapshotsByControlId,
  dayPoints,
}: {
  controlIds: string[];
  currentStatusByControlId: Record<string, string>;
  snapshotsByControlId: Map<string, Array<{ recordedAtMs: number; status: string }>>;
  dayPoints: DayPoint[];
}): number[] {
  const cursors: Record<string, number> = {};
  for (const id of controlIds) cursors[id] = -1;

  const dayPassRates: number[] = [];

  for (const day of dayPoints) {
    let passCount = 0;
    const total = controlIds.length || 1;

    for (const controlId of controlIds) {
      const snaps = snapshotsByControlId.get(controlId) ?? [];
      let cursor = cursors[controlId] ?? -1;

      while (cursor + 1 < snaps.length && snaps[cursor + 1]!.recordedAtMs <= day.endMs) {
        cursor += 1;
      }

      cursors[controlId] = cursor;
      const effectiveStatus =
        cursor >= 0 ? snaps[cursor]!.status : currentStatusByControlId[controlId] ?? "pending";

      if (mapSnapshotStatusToPass(effectiveStatus) || statusIsPassing(effectiveStatus)) {
        passCount += 1;
      }
    }

    dayPassRates.push(Math.round((passCount / total) * 100));
  }

  // Guarantee the expected shape for schema validation.
  return dayPassRates.length === 30 ? dayPassRates : Array.from({ length: 30 }).map((_, i) => dayPassRates[i] ?? 0);
}

export async function dashboardRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/v1/dashboard",
    { preHandler: dashboardPreHandlers },
    async (request, reply) => {
      const schema = request.tenant.schemaName;
      const tenantId = request.tenant.tenantId;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;

      const cacheKey = `${DASHBOARD_CACHE_PREFIX}${tenantId}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as unknown;
          return reply.send({ data: parsed });
        } catch {
          // fall through on cache parse errors
        }
      }

      const summaryRows = await prisma.$queryRawUnsafe<ControlSummaryRow[]>(
        `SELECT id, domain, status FROM "${schema}".control_items`
      );

      const summaryCounts = { passing: 0, attention: 0, failing: 0 };

      const byDomain = new Map<
        string,
        {
          domain: string;
          total: number;
          passing: number;
          attention: number;
          failing: number;
        }
      >();

      const controlIdsByDomain = new Map<string, string[]>();
      const currentStatusByControlId: Record<string, string> = {};

      for (const r of summaryRows) {
        currentStatusByControlId[r.id] = r.status;
        const ds =
          byDomain.get(r.domain) ??
          ({
            domain: r.domain,
            total: 0,
            passing: 0,
            attention: 0,
            failing: 0,
          } as const);

        if (!byDomain.has(r.domain)) byDomain.set(r.domain, { ...(ds as any) });
        const dsMut = byDomain.get(r.domain)!;
        dsMut.total += 1;

        if (toDomainStatus(r.status) === "fail") dsMut.failing += 1;
        else if (toDomainStatus(r.status) === "warn") dsMut.attention += 1;
        else if (statusIsPassing(r.status)) dsMut.passing += 1;

        const arr = controlIdsByDomain.get(r.domain) ?? [];
        arr.push(r.id);
        controlIdsByDomain.set(r.domain, arr);
      }

      for (const ds of byDomain.values()) {
        summaryCounts.passing += ds.passing;
        summaryCounts.attention += ds.attention;
        summaryCounts.failing += ds.failing;
      }

      const domains = [...byDomain.values()].sort((a, b) => a.domain.localeCompare(b.domain));

      const dayPoints = buildDayPoints(Date.now());
      const snapshotsByControlId = new Map<string, Array<{ recordedAtMs: number; status: string }>>();

      // Pull snapshots only for controls currently present in the read model.
      const allControlIds = summaryRows.map((r) => r.id);
      if (allControlIds.length > 0) {
        const snapshotRows = (await prisma.$queryRawUnsafe<ControlSnapshotRow[]>(
          `SELECT control_id, status, recorded_at
           FROM "${schema}".control_health_snapshots
           WHERE tenant_id = $1
             AND control_id = ANY($2::text[])
             AND recorded_at >= NOW() - interval '30 days'
           ORDER BY control_id ASC, recorded_at ASC`,
          tenantId,
          allControlIds
        )) ?? [];

        for (const s of snapshotRows) {
          const id = s.control_id;
          const arr = snapshotsByControlId.get(id) ?? [];
          const recordedAtMs = s.recorded_at instanceof Date ? s.recorded_at.getTime() : new Date(s.recorded_at).getTime();
          arr.push({ recordedAtMs, status: s.status });
          snapshotsByControlId.set(id, arr);
        }
      }

      const domainsWithCards = await Promise.all(
        domains.map(async (ds) => {
          const passRatePct = ds.total > 0 ? Math.round((ds.passing / ds.total) * 100) : 0;

          const topIssueRow =
            (await prisma.$queryRawUnsafe<
              Array<{ id: string; name: string; status: string }>
            >(
              `SELECT id, name, status
               FROM "${schema}".control_items
               WHERE domain = $1
                 AND status IN ('fail','warn')
               ORDER BY CASE status WHEN 'fail' THEN 0 ELSE 1 END, updated_at DESC
               LIMIT 1`,
              ds.domain
            )) ?? [];

          const topIssue = topIssueRow[0]
            ? {
                controlId: topIssueRow[0]!.id,
                controlName: topIssueRow[0]!.name,
                status: topIssueRow[0]!.status === "fail" ? ("fail" as const) : ("warn" as const),
              }
            : null;

          const controlIds = controlIdsByDomain.get(ds.domain) ?? [];
          const sparkline30d = controlIds.length
            ? computeSparkline30d({
                controlIds,
                currentStatusByControlId,
                snapshotsByControlId,
                dayPoints,
              })
            : Array.from({ length: 30 }).map(() => 0);

          const cardStatus = domainCardStatus(ds.failing, ds.attention, ds.total);

          return {
            domain: ds.domain,
            status: cardStatus,
            passRatePct,
            controlCount: ds.total,
            topIssue,
            sparkline30d,
          };
        })
      );

      const feedRows = await prisma.$queryRawUnsafe<ControlRow[]>(
        `SELECT id, name, domain, status
         FROM "${schema}".control_items
         WHERE status IN ('fail','warn')
         ORDER BY CASE status WHEN 'fail' THEN 0 ELSE 1 END, updated_at DESC
         LIMIT 20`
      );
      const safeFeedRows = feedRows ?? [];

      const feed = safeFeedRows.map((r) => ({
        id: `control-${r.id}`,
        severity: r.status === "fail" ? ("fail" as const) : ("warn" as const),
        title: `${r.status === "fail" ? "Failing" : "Needs attention"}: ${r.name}`,
        meta: r.domain,
        controlId: r.id,
      }));

      const readModel = {
        summary: {
          passing: summaryCounts.passing,
          attention: summaryCounts.attention,
          failing: summaryCounts.failing,
          passingDeltaWeek: 0,
          trajectoryScore: null as number | null,
        },
        domains: domainsWithCards.map((d) => ({
          ...d,
          sparkline30d: d.sparkline30d.length === 30 ? d.sparkline30d : Array.from({ length: 30 }).map(() => 0),
        })),
        feed,
      };
      await redis.set(cacheKey, JSON.stringify(readModel), "EX", DASHBOARD_CACHE_TTL_SEC);
      return reply.send({ data: readModel });
    }
  );
}

