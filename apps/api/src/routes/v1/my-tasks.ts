import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@grc/db";
import { VertexAIProvider, generateWhyNeeded, stripCodesAndJargon } from "@grc/ai";
import {
  createBlobStorageFromEnv,
  getEffectiveEvidenceBucketName,
  getEvidenceBucketName,
  submitControlOwnerNoteEvidence,
} from "@grc/evidence-ingestion";
import { ensureTenantSchemaNameOrReply } from "../../lib/tenant-schema.js";
import { requireTier } from "../../middleware/rbac.js";

type MyTasksReadModel = {
  summary: { taskCount: number; automatedCount: number };
  tasks: Array<{
    controlId: string;
    assignmentId: string;
    title: string;
    description: string;
    dueDate: string | null;
    status: "todo" | "complete";
  }>;
};

function isAutomatedOrPassing(status: string): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "auto" || s === "pass" || s === "passing";
}

export async function myTasksRoutes(fastify: FastifyInstance): Promise<void> {
  const ai = new VertexAIProvider();

  fastify.get(
    "/v1/my-tasks",
    {
      preHandler: [
        requireTier("starter"),
        async (request, reply) => {
          // D4 view is exclusively for ControlOwner; do not allow "higher" roles via ROLE_SATISFIES.
          if (request.user?.role !== "ControlOwner") {
            return reply.code(403).send({
              error: { code: "FORBIDDEN", message: "Insufficient permissions" },
            });
          }
        },
      ],
    },
    async (request, reply) => {
      const schema = request.tenant.schemaName;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;

      const userId = request.user?.userId;
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHENTICATED", message: "Authentication required" },
        });
      }

      const rows = await prisma.$queryRawUnsafe<
        Array<{
          control_id: string;
          assignment_id: string;
          control_name: string;
          domain: string;
          control_status: string;
          due_date: string | null;
          completed_at: string | null;
        }>
      >(
        `SELECT
           ca.control_item_id AS control_id,
           ca.id AS assignment_id,
           ci.name AS control_name,
           ci.domain AS domain,
           ci.status AS control_status,
           ca.due_date::text AS due_date,
           toc.completed_at::text AS completed_at
         FROM "${schema}".control_assignments ca
         JOIN "${schema}".control_items ci
           ON ci.id = ca.control_item_id
         LEFT JOIN "${schema}".control_owner_task_completions toc
           ON toc.assignment_id = ca.id
         WHERE ca.assigned_to = $1 AND ca.is_current = TRUE
         ORDER BY ca.due_date NULLS LAST, ca.created_at DESC`,
        userId
      );

      let automatedCount = 0;
      const tasks: MyTasksReadModel["tasks"] = [];

      for (const r of rows) {
        if (isAutomatedOrPassing(r.control_status)) {
          automatedCount += 1;
          continue;
        }
        const status: "todo" | "complete" = r.completed_at ? "complete" : "todo";
        tasks.push({
          controlId: r.control_id,
          assignmentId: r.assignment_id,
          title: stripCodesAndJargon(`Review: ${r.control_name}`),
          description: stripCodesAndJargon(
            `Review the latest information for ${r.control_name} and confirm everything looks correct.`
          ),
          dueDate: r.due_date,
          status,
        });
      }

      const todoCount = tasks.filter((t) => t.status === "todo").length;
      const data: MyTasksReadModel = {
        summary: { taskCount: todoCount, automatedCount },
        tasks,
      };

      const payload = JSON.stringify(data);
      if (/(SOC2:|ISO27001:|CC\d|A\.\d)/i.test(payload)) {
        request.log.warn(
          { userId },
          "my-tasks payload still matched code-like patterns after server-side strip; check stripCodesAndJargon"
        );
      }

      return reply.send({ data });
    }
  );

  fastify.post(
    "/v1/my-tasks/:controlId/why-needed",
    {
      preHandler: [
        requireTier("starter"),
        async (request, reply) => {
          if (request.user?.role !== "ControlOwner") {
            return reply.code(403).send({
              error: { code: "FORBIDDEN", message: "Insufficient permissions" },
            });
          }
        },
      ],
    },
    async (request, reply) => {
      const schema = request.tenant.schemaName;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;

      const userId = request.user?.userId;
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHENTICATED", message: "Authentication required" },
        });
      }

      const controlId = (request as FastifyRequest<{ Params: { controlId: string } }>).params?.controlId;
      if (!controlId) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "Control id required" },
        });
      }

      const [controlRows, integrationRows] = await Promise.all([
        prisma.$queryRawUnsafe<
          Array<{ id: string; name: string; domain: string }>
        >(
          `SELECT ci.id, ci.name, ci.domain
           FROM "${schema}".control_assignments ca
           JOIN "${schema}".control_items ci
             ON ci.id = ca.control_item_id
           WHERE ca.assigned_to = $1 AND ca.is_current = TRUE AND ca.control_item_id = $2
           LIMIT 1`,
          userId,
          controlId
        ),
        prisma.$queryRawUnsafe<Array<{ provider: string }>>(
          `SELECT provider FROM "${schema}".integration_configs
           WHERE status = 'connected'
           ORDER BY provider`
        ),
      ]);

      const control = controlRows[0];
      if (!control) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
      }

      const connectedIntegrations = integrationRows.map((r) => r.provider);
      const rawText = await generateWhyNeeded(ai, {
        controlName: control.name,
        domain: control.domain,
        connectedIntegrations,
      });
      const text = stripCodesAndJargon(rawText);

      const generatedAt = new Date().toISOString();

      const payload = JSON.stringify({ text });
      if (/(SOC2:|ISO27001:|CC\d|A\.\d)/i.test(payload)) {
        request.log.warn(
          { userId, controlId },
          "why-needed text still matched code-like patterns after server-side strip"
        );
      }

      return reply.send({ data: { text, generatedAt } });
    }
  );

  fastify.post(
    "/v1/my-tasks/:controlId/complete",
    {
      preHandler: [
        requireTier("starter"),
        async (request, reply) => {
          if (request.user?.role !== "ControlOwner") {
            return reply.code(403).send({
              error: { code: "FORBIDDEN", message: "Insufficient permissions" },
            });
          }
        },
      ],
    },
    async (request, reply) => {
      const schema = request.tenant.schemaName;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;

      const userId = request.user?.userId;
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHENTICATED", message: "Authentication required" },
        });
      }

      const controlId = (request as FastifyRequest<{ Params: { controlId: string } }>).params?.controlId;
      if (!controlId) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "Control id required" },
        });
      }

      const body = (request as FastifyRequest<{ Body: unknown }>).body as unknown;
      const evidenceText =
        body && typeof body === "object" && "evidenceText" in (body as Record<string, unknown>)
          ? String((body as Record<string, unknown>).evidenceText ?? "")
          : "";

      if (!evidenceText || evidenceText.trim().length < 5) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "Evidence text required" },
        });
      }

      // Ensure the task exists and is assigned to this control owner.
      const assignmentRows = await prisma.$queryRawUnsafe<Array<{ assignment_id: string }>>(
        `SELECT ca.id AS assignment_id
         FROM "${schema}".control_assignments ca
         WHERE ca.assigned_to = $1 AND ca.is_current = TRUE AND ca.control_item_id = $2
         LIMIT 1`,
        userId,
        controlId
      );

      const assignmentId = assignmentRows[0]?.assignment_id;
      if (!assignmentId) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Insufficient permissions" },
        });
      }

      if (process.env["NODE_ENV"] === "production" && !getEvidenceBucketName()) {
        return reply.code(503).send({
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Evidence storage is not configured",
          },
        });
      }

      const storage = createBlobStorageFromEnv();
      const bucketName = getEffectiveEvidenceBucketName();

      const { evidenceItemId } = await submitControlOwnerNoteEvidence({
        prisma,
        schemaName: schema,
        tenantId: request.tenant.tenantId,
        controlItemId: controlId,
        assignmentId,
        userId,
        evidenceText,
        storage,
        bucketName,
      });

      return reply.send({ data: { controlId, status: "complete", evidenceItemId } });
    }
  );
}

