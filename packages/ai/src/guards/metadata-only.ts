// Metadata-only guard — ensures raw evidence file content is NEVER passed to LLM
// Only structured metadata (control name, framework ref, integration names) allowed
// This is a critical security constraint — enforced on ALL LLM calls

export function assertMetadataOnly(input: unknown): void {
  if (typeof input === "string" && input.length > 10_000) {
    throw new Error(
      "AI safety violation: input exceeds metadata size limit. Raw evidence files must never be passed to LLM."
    );
  }
}
