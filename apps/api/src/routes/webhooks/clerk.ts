import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/backend";
import { prisma, provisionTenantSchema, tenantSchemaName } from "@grc/db";
import type { TenantId } from "@grc/types";
import { redis } from "../../plugins/redis.js";

/** Canonical Redis cache key for tenant RBAC data. Format: rbac:{tenantId}:{userId} */
export const rbacCacheKey = (tenantId: string, userId: string) => `rbac:${tenantId}:${userId}`;

type SvixHeaders = {
  "svix-id": string;
  "svix-timestamp": string;
  "svix-signature": string;
};

export async function clerkWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/webhooks/clerk",
    { config: { rawBody: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const secret = process.env["CLERK_WEBHOOK_SIGNING_SECRET"];
      if (!secret) {
        fastify.log.error("CLERK_WEBHOOK_SIGNING_SECRET not configured");
        return reply.code(500).send({ error: { code: "SERVER_ERROR" } });
      }

      const svixId = request.headers["svix-id"] as string;
      const svixTimestamp = request.headers["svix-timestamp"] as string;
      const svixSignature = request.headers["svix-signature"] as string;

      if (!svixId || !svixTimestamp || !svixSignature) {
        return reply.code(400).send({ error: { code: "MISSING_SVIX_HEADERS" } });
      }

      const wh = new Webhook(secret);
      let event: WebhookEvent;
      try {
        const rawBody = (request as unknown as { rawBody: string }).rawBody;
        event = wh.verify(rawBody, {
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": svixSignature,
        } as SvixHeaders) as WebhookEvent;
      } catch {
        return reply.code(400).send({ error: { code: "INVALID_SIGNATURE" } });
      }

      try {
        await handleWebhookEvent(event, fastify);
      } catch (err) {
        fastify.log.error({ event: event.type, err }, "Webhook handler error");
        return reply.code(500).send({ error: { code: "HANDLER_ERROR" } });
      }

      return reply.code(200).send({ received: true });
    }
  );
}

async function handleWebhookEvent(event: WebhookEvent, fastify: FastifyInstance): Promise<void> {
  switch (event.type) {
    case "organization.created": {
      const org = event.data;
      const tenantId = org.id as TenantId;
      const schema = tenantSchemaName(tenantId);
      await provisionTenantSchema(tenantId);
      await (prisma.$executeRawUnsafe as (sql: string, ...args: unknown[]) => Promise<number>)(
        `INSERT INTO "${schema}".tenants (id, name, tier) VALUES ($1, $2, 'starter') ON CONFLICT (id) DO NOTHING`,
        tenantId,
        org.name ?? ""
      );
      fastify.log.info({ tenantId }, "Tenant schema provisioned");
      break;
    }

    case "organizationMembership.created": {
      const membership = event.data;
      const tenantId = membership.organization.id as TenantId;
      const userId = membership.public_user_data.user_id;
      const email = membership.public_user_data.identifier ?? "";
      const firstName = membership.public_user_data.first_name ?? "";
      const lastName = membership.public_user_data.last_name ?? "";
      const name = [firstName, lastName].filter(Boolean).join(" ");
      const schema = tenantSchemaName(tenantId);
      await (prisma.$executeRawUnsafe as (sql: string, ...args: unknown[]) => Promise<number>)(
        `INSERT INTO "${schema}".users (id, email, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, updated_at = NOW()`,
        userId,
        email,
        name
      );
      await (prisma.$executeRawUnsafe as (sql: string, ...args: unknown[]) => Promise<number>)(
        `INSERT INTO "${schema}".role_assignments (user_id, role) SELECT $1, 'ControlOwner' WHERE NOT EXISTS (SELECT 1 FROM "${schema}".role_assignments WHERE user_id = $1 AND business_unit_id IS NULL)`,
        userId
      );
      // Track user→tenant mapping for user.deleted lookups
      await (prisma.$executeRawUnsafe as (sql: string, ...args: unknown[]) => Promise<number>)(
        `INSERT INTO public.user_tenant_map (user_id, tenant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        userId,
        tenantId
      );
      fastify.log.info({ tenantId, userId }, "User membership created");
      break;
    }

    case "organizationMembership.deleted": {
      const membership = event.data;
      const tenantId = membership.organization.id as TenantId;
      const userId = membership.public_user_data?.user_id;
      if (!userId) break;
      const schema = tenantSchemaName(tenantId);
      await (prisma.$executeRawUnsafe as (sql: string, ...args: unknown[]) => Promise<number>)(
        `DELETE FROM "${schema}".role_assignments WHERE user_id = $1`,
        userId
      );
      await redis.del(rbacCacheKey(tenantId, userId));
      fastify.log.info({ tenantId, userId }, "User membership deleted");
      break;
    }

    case "organization.deleted": {
      // TODO Story 1.x: full tenant offboarding (schema drop, GCS cleanup, billing stop).
      // For now, log and alert so ops can action manually — silent inaction would leave orphaned data.
      const org = event.data;
      fastify.log.warn({ tenantId: org.id }, "organization.deleted received — manual offboarding required");
      break;
    }

    case "user.deleted": {
      const userData = event.data;
      const userId = userData.id;
      if (!userId) break;
      // Mark user inactive in all tenant schemas they belong to
      // Tenant mapping resolved via user_tenant_map (public schema)
      const tenantRows = await (prisma.$queryRawUnsafe as (sql: string, ...args: unknown[]) => Promise<Array<{ tenant_id: string }>>)(
        `SELECT tenant_id FROM public.user_tenant_map WHERE user_id = $1`,
        userId
      );
      for (const row of tenantRows) {
        const tenantId = row.tenant_id as TenantId;
        const schema = tenantSchemaName(tenantId);
        await (prisma.$executeRawUnsafe as (sql: string, ...args: unknown[]) => Promise<number>)(
          `UPDATE "${schema}".users SET active = FALSE, updated_at = NOW() WHERE id = $1`,
          userId
        );
        await redis.del(rbacCacheKey(tenantId, userId));
      }
      fastify.log.info({ userId }, "User deleted, sessions flushed");
      break;
    }

    default:
      break;
  }
}
