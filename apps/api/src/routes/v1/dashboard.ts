import type { FastifyInstance } from "fastify";
import { prisma } from "@grc/db";
import { requireRole, requireTier } from "../../middleware/rbac.js";
import { ensureTenantSchemaNameOrReply } from "../../lib/tenant-schema.js";
import { redis } from "../../plugins/redis.js";

const dashboardPreHandlers = [requireTier("starter"), requireRole("OrgAdmin")];

const DASHBOARD_CACHE_PREFIX = "grc:dashboard:";
const DASHBOARD_CACHE_TTL_SEC = 30;

type ControlRow = { id: string; name: string; domain: string; status: string };

function toDomainStatus(status: string): "pass" | "warn" | "fail" | "pending" {
  if (status === "fail") return "fail";
  if (status === "warn") return "warn";
  if (status === "pass" || status === "auto") return "pass";
  return "pending";
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

      const rows = await prisma.$queryRawUnsafe<ControlRow[]>(
        `SELECT id, name, domain, status FROM "${schema}".control_items`
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
          topFail: ControlRow | null;
          topWarn: ControlRow | null;
        }
      >();

      for (const r of rows) {
        const ds = byDomain.get(r.domain) ?? {
          domain: r.domain,
          total: 0,
          passing: 0,
          attention: 0,
          failing: 0,
          topFail: null,
          topWarn: null,
        };
        ds.total += 1;

        if (r.status === "fail") {
          ds.failing += 1;
          if (!ds.topFail) ds.topFail = r;
        } else if (r.status === "warn") {
          ds.attention += 1;
          if (!ds.topWarn) ds.topWarn = r;
        } else if (r.status === "pass" || r.status === "auto") {
          ds.passing += 1;
        }

        byDomain.set(r.domain, ds);
      }

      for (const ds of byDomain.values()) {
        summaryCounts.passing += ds.passing;
        summaryCounts.attention += ds.attention;
        summaryCounts.failing += ds.failing;
      }

      const domains = [...byDomain.values()]
        .sort((a, b) => a.domain.localeCompare(b.domain))
        .map((ds) => {
          const passRatePct = ds.total > 0 ? (ds.passing / ds.total) * 100 : 0;
          const top = ds.topFail ?? ds.topWarn;
          const topIssue =
            top && (top.status === "fail" || top.status === "warn")
              ? { controlId: top.id, controlName: top.name, status: top.status }
              : null;
          return {
            domain: ds.domain,
            status: toDomainStatus(ds.failing > 0 ? "fail" : ds.attention > 0 ? "warn" : "pass"),
            passRatePct,
            controlCount: ds.total,
            topIssue,
            // Placeholder until we have real 30-day history persisted server-side.
            sparkline30d: Array.from({ length: 30 }).map(() => Math.round(passRatePct)),
          };
        });

      const feed = rows
        .filter((r) => r.status === "fail" || r.status === "warn")
        .slice(0, 20)
        .map((r) => ({
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
        domains,
        feed,
      };

      await redis.set(cacheKey, JSON.stringify(readModel), "EX", DASHBOARD_CACHE_TTL_SEC);

      return reply.send({ data: readModel });
    }
  );
}

