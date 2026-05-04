// API response envelope types — all Fastify routes MUST use these shapes
// Single resource: { data: T, meta?: { version: string } }
// Collection: { data: T[], meta: { total: number, cursor: string | null, pageSize: number } }
// Error: { error: { code: string, message: string, details?: unknown } }

export type ApiSuccess<T> = {
  data: T;
  meta?: { version: string };
};

export type ApiCollection<T> = {
  data: T[];
  meta: {
    total: number;
    cursor: string | null;
    pageSize: number;
  };
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
