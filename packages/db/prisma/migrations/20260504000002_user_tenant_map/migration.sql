CREATE TABLE "user_tenant_map" (
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "user_tenant_map_pkey" PRIMARY KEY ("user_id","tenant_id")
);

CREATE INDEX "user_tenant_map_user_id_idx" ON "user_tenant_map"("user_id");
