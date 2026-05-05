import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadTenantTemplateSql(): string {
  return readFileSync(join(__dirname, "migrations", "tenant-template.sql"), "utf-8");
}

describe("tenant-template.sql", () => {
  it("includes control_assignments table (Story 3.3)", () => {
    const sql = loadTenantTemplateSql();
    expect(sql).toContain("CREATE TABLE control_assignments");
  });

  it("enforces one current assignment per control (Story 3.3)", () => {
    const sql = loadTenantTemplateSql();
    expect(sql).toContain("control_assignments_one_current_per_control");
  });
});

