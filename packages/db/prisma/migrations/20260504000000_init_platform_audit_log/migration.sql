-- Migration: 20260504000000_init_platform_audit_log
-- Creates the platform_audit_logs table in the public schema (ARCH-3)
-- This is the FIRST migration — must run before any tenant schemas are provisioned

-- CreateTable
CREATE TABLE "platform_audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Index for efficient per-tenant audit log queries
CREATE INDEX "idx_platform_audit_logs_tenant_id" ON "platform_audit_logs"("tenant_id");
CREATE INDEX "idx_platform_audit_logs_occurred_at" ON "platform_audit_logs"("occurred_at");

-- Enforce append-only: no UPDATE or DELETE permitted (ARCH-3)
-- Only INSERT and SELECT are allowed on this table
REVOKE UPDATE, DELETE ON "platform_audit_logs" FROM PUBLIC;
GRANT SELECT, INSERT ON "platform_audit_logs" TO PUBLIC;
