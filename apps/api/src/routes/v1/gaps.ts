import type { FastifyInstance } from "fastify";
import { prisma } from "@grc/db";
import {
  FRAMEWORK_LIBRARY_META,
  parseFrameworkRefsArray,
  type FrameworkId,
} from "@grc/types";
import { ensureTenantSchemaNameOrReply } from "../../lib/tenant-schema.js";
import { requireRole, requireTier } from "../../middleware/rbac.js";

const gapsPreHandlers = [requireTier("starter"), requireRole("AuditDirector")];

type GapRow = {
  id: string;
  name: string;
  domain: string;
  status: string;
  framework_refs: unknown;
  assigned_to: string | null;
  updated_at: Date | string | null;
  due_date: string | null;
};

export async function gapsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/v1/gaps", { preHandler: gapsPreHandlers }, async (request, reply) => {
    const schema = request.tenant.schemaName;
    if (!ensureTenantSchemaNameOrReply(reply, schema)) return;

    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({
        error: { code: "UNAUTHENTICATED", message: "Authentication required" },
      });
    }

    const rows = await prisma.$queryRawUnsafe<GapRow[]>(
      `SELECT c.id, c.name, c.domain, c.status, c.framework_refs,
              c.assigned_to, c.updated_at,
              a.due_date
       FROM "${schema}".control_items c
       LEFT JOIN "${schema}".control_assignments a
         ON a.control_item_id = c.id AND a.is_current = TRUE
       WHERE c.status IN ('warn', 'fail')
       ORDER BY CASE WHEN c.status = 'fail' THEN 0 ELSE 1 END ASC,
                c.updated_at DESC NULLS LAST,
                c.id ASC`
    );

    const items = rows.map((r) => {
      const frameworkRefs = Array.isArray(r.framework_refs)
        ? (r.framework_refs as string[])
        : typeof r.framework_refs === "string"
          ? (JSON.parse(r.framework_refs) as string[])
          : [];

      const frameworkIds = Array.from(
        new Set(parseFrameworkRefsArray(frameworkRefs).map((p) => p.frameworkId))
      ).sort((a, b) => a.localeCompare(b));

      return {
        controlId: r.id,
        name: r.name,
        domain: r.domain,
        status: r.status === "fail" ? ("fail" as const) : ("warn" as const),
        frameworks: frameworkIds.map((id) => ({
          key: id,
          name: FRAMEWORK_LIBRARY_META[id as FrameworkId]?.title ?? id,
        })),
        assignedTo: r.assigned_to ?? null,
        dueDate: r.due_date ?? null,
        updatedAt:
          r.updated_at instanceof Date
            ? r.updated_at.toISOString()
            : typeof r.updated_at === "string"
              ? r.updated_at
              : null,
      };
    });

    return reply.send({ data: { items } });
  });
}

