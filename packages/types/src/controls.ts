// Control types — implemented in Story 3.1

export type ControlStatus = "pass" | "warn" | "fail" | "pending" | "auto";

export type ControlItem = {
  id: string;
  tenantId: string;
  name: string;
  domain: string;
  frameworkRefs: string[]; // e.g. ["SOC2:CC6.1", "ISO27001:A.9.2"]
  status: ControlStatus;
  assignedTo: string | null;
  businessUnitId: string | null; // nullable — single-BU tenants use null (ARCH-5)
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
};
