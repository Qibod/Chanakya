// Injection guard — rejects obvious prompt-injection patterns and oversized payloads.

const BLOCKED = [/ignore (all )?(previous|prior) instructions/i, /system prompt/i, /<\|im_start\|>/i];

const MAX_CHARS = 48_000;

export function assertNoInjection(input: string): void {
  if (input.length > MAX_CHARS) {
    throw new Error("AI safety violation: input exceeds metadata size limit.");
  }
  for (const pattern of BLOCKED) {
    if (pattern.test(input)) {
      throw new Error("AI safety violation: potential prompt injection detected.");
    }
  }
}
