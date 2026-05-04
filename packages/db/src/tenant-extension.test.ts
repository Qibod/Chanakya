import { describe, it, expect, vi, beforeEach } from "vitest";
import { tenantSchemaName } from "./provision-tenant.js";
import { createTenantClient } from "./tenant-extension.js";

// ---------------------------------------------------------------------------
// Unit tests: schema name derivation (no DB required)
// ---------------------------------------------------------------------------
describe("tenantSchemaName", () => {
  it("strips hyphens and prepends tenant_ prefix", () => {
    expect(tenantSchemaName("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "tenant_550e8400e29b41d4a716446655440000"
    );
  });

  it("handles UUID without hyphens", () => {
    expect(tenantSchemaName("abcdef1234567890abcdef1234567890")).toBe(
      "tenant_abcdef1234567890abcdef1234567890"
    );
  });

  it("produces valid PostgreSQL identifier format", () => {
    const schema = tenantSchemaName("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    expect(schema).toMatch(/^tenant_[a-f0-9]+$/);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: createTenantClient shape (mocked Prisma — no DB required)
// ---------------------------------------------------------------------------
describe("createTenantClient", () => {
  const mockExecuteRawUnsafe = vi.fn().mockResolvedValue(0);
  const mockTransaction = vi.fn().mockImplementation(async (ops: unknown[]) => {
    const results = await Promise.all(
      (ops as Array<Promise<unknown>>).map((op) => op)
    );
    return results;
  });

  const mockExtends = vi.fn().mockReturnValue({ _isMockClient: true });

  const mockPrisma = {
    $extends: mockExtends,
    $executeRawUnsafe: mockExecuteRawUnsafe,
    $transaction: mockTransaction,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockExtends.mockReturnValue({ _isMockClient: true });
  });

  it("calls $extends on the base client", () => {
    createTenantClient(
      mockPrisma as unknown as Parameters<typeof createTenantClient>[0],
      "550e8400-e29b-41d4-a716-446655440000"
    );
    expect(mockExtends).toHaveBeenCalledOnce();
  });

  it("passes extension name 'tenant-isolation'", () => {
    createTenantClient(
      mockPrisma as unknown as Parameters<typeof createTenantClient>[0],
      "550e8400-e29b-41d4-a716-446655440000"
    );
    const extensionArg = mockExtends.mock.calls[0]?.[0] as {
      name?: string;
    };
    expect(extensionArg?.name).toBe("tenant-isolation");
  });

  it("includes correct schema name in search_path call", async () => {
    // Simulate the $allOperations interceptor calling $executeRawUnsafe
    const capturedExtension = {
      name: "",
      query: { $allModels: { $allOperations: vi.fn() } },
    };
    mockExtends.mockImplementation((ext: typeof capturedExtension) => {
      Object.assign(capturedExtension, ext);
      return { _extended: true };
    });

    createTenantClient(
      mockPrisma as unknown as Parameters<typeof createTenantClient>[0],
      "550e8400-e29b-41d4-a716-446655440000"
    );

    // Invoke the interceptor manually
    const mockQuery = vi.fn().mockResolvedValue({ id: "test" });
    mockTransaction.mockResolvedValueOnce([0, { id: "test" }]);

    await capturedExtension.query.$allModels.$allOperations({
      args: { where: { id: "test" } },
      query: mockQuery,
      model: "controlItem",
      operation: "findFirst",
    });

    expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
      'SET LOCAL search_path = "tenant_550e8400e29b41d4a716446655440000", public'
    );
  });
});
