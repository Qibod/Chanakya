// AppError — implemented in Story 1.3
// All business errors thrown as new AppError(code, message, statusCode)
// Fastify setErrorHandler catches all; maps AppError → structured response; unknown → 500 + Sentry

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}
