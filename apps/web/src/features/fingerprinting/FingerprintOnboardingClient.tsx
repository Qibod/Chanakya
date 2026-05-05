"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfidenceChip } from "@grc/ui";
import {
  canRemoveFingerprintStreamLine,
  fingerprintInferencePayloadSchema,
  fingerprintJobEventSchema,
} from "@grc/types";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OnboardingStepHelp } from "@/features/onboarding/OnboardingStepHelp";
import { ONBOARDING_HELP_COPY } from "@/features/onboarding/onboardingHelpCopy";
import { buildFingerprintLines, type StreamLine } from "./build-fingerprint-lines";
import { PhaseProgressArc } from "./PhaseProgressArc";
import { FINGERPRINT_LINE_STAGGER_MS } from "./fingerprint-constants";
const POLL_INTERVAL_MS = 2000;
/** ~2 minutes cap before surfacing timeout (aligned with review). */
const POLL_MAX_ATTEMPTS = 60;
const TOOLTIP_SESSION_KEY = "grc_fp_confidence_tooltip_shown";
const PLACEHOLDER = "Type your company name…";

type JobOutcome = "pending" | "success" | "failed";

type UiState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "awaiting"; jobId: string }
  | { kind: "error"; message: string }
  | { kind: "failed_job"; reason: string };

function maxVisiblePhase(lines: StreamLine[], visibleCount: number): number {
  if (visibleCount <= 0) return 0;
  let m = 0;
  const n = Math.min(visibleCount, lines.length);
  for (let i = 0; i < n; i++) {
    m = Math.max(m, lines[i]!.phase);
  }
  return m;
}

export function FingerprintOnboardingClient() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [ui, setUi] = useState<UiState>({ kind: "idle" });
  const [lines, setLines] = useState<StreamLine[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [bulkEdit, setBulkEdit] = useState(false);
  const [removedLineIds, setRemovedLineIds] = useState<string[]>([]);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [sourcesPopover, setSourcesPopover] = useState<string | null>(null);
  const [confTooltipVisible, setConfTooltipVisible] = useState(false);
  /** One-shot tip text for first-in-session hover (sessionStorage marks session). */
  const [showFirstSessionTip, setShowFirstSessionTip] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobOutcomeRef = useRef<JobOutcome>("pending");
  const activeJobIdRef = useRef<string | null>(null);
  const popoverContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const fn = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleInferencePayload = useCallback(
    (payload: unknown) => {
      if (jobOutcomeRef.current !== "pending") return;
      const parsed = fingerprintInferencePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        jobOutcomeRef.current = "failed";
        setUi({
          kind: "error",
          message: "Fingerprint results could not be read. Try manual setup.",
        });
        return;
      }
      jobOutcomeRef.current = "success";
      const built = buildFingerprintLines(parsed.data);
      setLines(built);
      setUi({ kind: "idle" });
      if (reduceMotion) {
        setVisibleCount(built.length);
      } else {
        setVisibleCount(0);
      }
    },
    [reduceMotion]
  );

  useEffect(() => {
    if (lines.length === 0) return;
    if (reduceMotion) {
      setVisibleCount(lines.length);
      return;
    }
    if (visibleCount >= lines.length) return;
    const t = window.setTimeout(() => {
      setVisibleCount((c) => Math.min(c + 1, lines.length));
    }, FINGERPRINT_LINE_STAGGER_MS);
    return () => clearTimeout(t);
  }, [lines.length, visibleCount, reduceMotion, lines]);

  const startPolling = useCallback(
    (jobId: string) => {
      stopPoll();
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        if (jobOutcomeRef.current !== "pending") {
          stopPoll();
          return;
        }
        if (activeJobIdRef.current !== jobId) {
          stopPoll();
          return;
        }
        attempts += 1;
        if (attempts > POLL_MAX_ATTEMPTS) {
          stopPoll();
          jobOutcomeRef.current = "failed";
          setUi({
            kind: "failed_job",
            reason: "POLL_TIMEOUT",
          });
          return;
        }
        try {
          const res = await fetch(`/api/v1/fingerprint/${encodeURIComponent(jobId)}`, {
            credentials: "same-origin",
            cache: "no-store",
          });
          const body = (await res.json()) as {
            data?: {
              rowStatus?: string;
              failureReason?: string | null;
              inference?: unknown | null;
            };
          };
          if (!res.ok) return;
          const row = body.data;
          if (!row) return;
          if (row.rowStatus === "failed") {
            stopPoll();
            jobOutcomeRef.current = "failed";
            setUi({
              kind: "failed_job",
              reason: row.failureReason ?? "UNKNOWN",
            });
            return;
          }
          if (row.inference && row.rowStatus === "pending_review") {
            stopPoll();
            setUi({ kind: "idle" });
            handleInferencePayload(row.inference);
          }
        } catch {
          /* ignore transient */
        }
      }, POLL_INTERVAL_MS);
    },
    [handleInferencePayload, stopPoll]
  );

  const connectSse = useCallback(
    (jobId: string) => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      const url = `/api/v1/stream/jobs/${encodeURIComponent(jobId)}`;
      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;

      const onCompleted = (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data as string) as unknown;
          const wrapped = {
            event: "fingerprint.completed" as const,
            data,
          };
          const ok = fingerprintJobEventSchema.safeParse(wrapped);
          if (!ok.success) return;
          if (ok.data.event !== "fingerprint.completed") return;
          const summary = ok.data.data.payload.summary;
          if (summary) {
            handleInferencePayload(summary);
          }
        } catch {
          /* ignore */
        }
        es.close();
        stopPoll();
      };

      const onFailed = (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data as string) as unknown;
          const wrapped = { event: "fingerprint.failed" as const, data };
          const ok = fingerprintJobEventSchema.safeParse(wrapped);
          if (ok.success && ok.data.event === "fingerprint.failed") {
            jobOutcomeRef.current = "failed";
            setUi({
              kind: "failed_job",
              reason: ok.data.data.payload.failureReason,
            });
          }
        } catch {
          jobOutcomeRef.current = "failed";
          setUi({ kind: "failed_job", reason: "UNKNOWN" });
        }
        es.close();
        stopPoll();
      };

      es.addEventListener("fingerprint.completed", onCompleted);
      es.addEventListener("fingerprint.failed", onFailed);
      es.onerror = () => {
        es.close();
        if (jobOutcomeRef.current !== "pending") {
          return;
        }
        startPolling(jobId);
      };
    },
    [handleInferencePayload, startPolling, stopPoll]
  );

  useEffect(
    () => () => {
      esRef.current?.close();
      stopPoll();
    },
    [stopPoll]
  );

  useEffect(() => {
    if (sourcesPopover === null) {
      popoverContainerRef.current = null;
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSourcesPopover(null);
    };
    const onDown = (e: MouseEvent) => {
      if (
        popoverContainerRef.current &&
        e.target instanceof Node &&
        !popoverContainerRef.current.contains(e.target)
      ) {
        setSourcesPopover(null);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [sourcesPopover]);

  const submit = async () => {
    const name = companyName.trim();
    if (!name) return;

    esRef.current?.close();
    esRef.current = null;
    stopPoll();
    jobOutcomeRef.current = "pending";
    activeJobIdRef.current = null;

    try {
      sessionStorage.removeItem("grc_onboarding_overlap_percent");
    } catch {
      /* ignore */
    }

    setUi({ kind: "submitting" });
    setLines([]);
    setVisibleCount(0);
    setOverrides({});
    setEdited({});
    setBulkEdit(false);
    setRemovedLineIds([]);
    setConfirmError(null);

    try {
      const res = await fetch("/api/v1/fingerprint", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: name }),
      });
      const body = (await res.json()) as {
        data?: { jobId?: string };
        error?: { code?: string; message?: string };
      };

      if (res.status === 202 && body.data?.jobId) {
        const jobId = body.data.jobId;
        activeJobIdRef.current = jobId;
        setUi({ kind: "awaiting", jobId });
        connectSse(jobId);
        return;
      }

      setUi({
        kind: "error",
        message: body.error?.message ?? "Could not start fingerprinting.",
      });
    } catch {
      setUi({ kind: "error", message: "Network error. Try again." });
    }
  };

  const saveOverride = (id: string, line: StreamLine) => {
    const def = `${line.title}: ${line.detail}`;
    if (editDraft.trim() === def.trim()) {
      setOverrides((o) => {
        const next = { ...o };
        delete next[id];
        return next;
      });
      setEdited((e) => ({ ...e, [id]: false }));
    } else {
      setOverrides((o) => ({ ...o, [id]: editDraft }));
      setEdited((e) => ({ ...e, [id]: true }));
    }
    setEditingId(null);
  };

  const lineText = (line: StreamLine) =>
    overrides[line.id] ?? `${line.title}: ${line.detail}`;

  const streamComplete = lines.length > 0 && visibleCount >= lines.length;

  const phaseSourceLines = useMemo(() => {
    if (!streamComplete) return lines.slice(0, visibleCount);
    return lines.filter((l) => !removedLineIds.includes(l.id));
  }, [lines, visibleCount, streamComplete, removedLineIds]);

  const activePhase = useMemo(
    () => maxVisiblePhase(phaseSourceLines, phaseSourceLines.length),
    [phaseSourceLines]
  );

  const confirmLabel =
    bulkEdit || removedLineIds.length > 0
      ? "Confirm my edits — let's continue"
      : "Looks right — let's continue";

  const allStreamLineIds = useMemo(() => lines.map((l) => l.id), [lines]);

  const confirmFingerprint = async () => {
    const jobId = activeJobIdRef.current;
    if (!jobId || !streamComplete) return;
    setConfirmBusy(true);
    setConfirmError(null);
    const filteredOverrides = Object.fromEntries(
      Object.entries(overrides).filter(([id]) => !removedLineIds.includes(id))
    );
    try {
      const res = await fetch(
        `/api/v1/fingerprint/${encodeURIComponent(jobId)}/confirm`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            overrides: filteredOverrides,
            removedLineIds,
          }),
        }
      );
      const body = (await res.json()) as {
        data?: { status?: string };
        error?: { code?: string; message?: string; details?: unknown };
      };

      const committed =
        (res.ok && body.data?.status === "committed") ||
        (res.status === 409 && body.error?.code === "ALREADY_COMMITTED");

      if (committed) {
        try {
          sessionStorage.setItem("grc_onboarding_fingerprint_complete", "1");
          sessionStorage.setItem("grc_last_fingerprint_job_id", jobId);
        } catch {
          /* ignore */
        }
        await queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] });
        router.push("/onboarding/frameworks");
        return;
      }

      if (!res.ok) {
        const code = body.error?.code;
        if (code === "REQUIRED_LIST_EMPTY") {
          setConfirmError(
            body.error?.message ??
              "Keep at least one line in obligations, business processes, and risk domains."
          );
        } else if (code === "VALIDATION_ERROR" && body.error?.message) {
          setConfirmError(body.error.message);
        } else {
          setConfirmError(
            body.error?.message ?? "Could not save fingerprint. Try again."
          );
        }
        return;
      }

      setConfirmError("Unexpected response from server. Try again.");
    } catch {
      setConfirmError("Network error. Try again.");
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[70vh] max-w-2xl flex-col px-4 py-16"
    >
      <h1 className="sr-only">Company fingerprint onboarding</h1>

      <div className="mb-6 flex items-center gap-2">
        <p className="text-foreground text-lg font-medium">Company fingerprint</p>
        <OnboardingStepHelp content={ONBOARDING_HELP_COPY.fingerprint} />
      </div>

      {ui.kind === "error" && (
        <div
          className="mb-6 rounded-lg border border-status-fail/40 bg-status-fail-bg px-4 py-3 text-sm text-foreground"
          role="alert"
        >
          <p>{ui.message}</p>
          <div className="mt-3 flex flex-wrap gap-4">
            <button
              type="button"
              className="text-accent font-medium underline"
              onClick={() => {
                jobOutcomeRef.current = "pending";
                activeJobIdRef.current = null;
                setUi({ kind: "idle" });
              }}
            >
              Try again
            </button>
            <Link href="/onboarding/manual-setup" className="font-medium text-accent underline">
              Continue with manual setup
            </Link>
          </div>
        </div>
      )}

      {ui.kind === "failed_job" && (
        <div
          className="mb-6 rounded-lg border border-status-warn/40 bg-status-warn-bg px-4 py-3 text-sm text-foreground"
          role="alert"
        >
          <p>Fingerprinting didn&apos;t finish ({ui.reason}).</p>
          <div className="mt-3 flex flex-wrap gap-4">
            <button
              type="button"
              className="text-accent font-medium underline"
              onClick={() => {
                jobOutcomeRef.current = "pending";
                activeJobIdRef.current = null;
                setUi({ kind: "idle" });
                setCompanyName("");
              }}
            >
              Try again
            </button>
            <Link href="/onboarding/manual-setup" className="font-medium text-accent underline">
              Continue with manual setup
            </Link>
          </div>
        </div>
      )}

      <div className="relative flex flex-col gap-8">
        {lines.length === 0 &&
          (ui.kind === "idle" ||
            ui.kind === "submitting" ||
            ui.kind === "awaiting" ||
            ui.kind === "error") && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label className="sr-only" htmlFor="company-name">
                Company name
              </label>
              <input
                ref={inputRef}
                id="company-name"
                autoFocus
                autoComplete="organization"
                placeholder={PLACEHOLDER}
                value={companyName}
                disabled={
                  ui.kind === "submitting" ||
                  ui.kind === "awaiting" ||
                  (lines.length > 0 && confirmBusy)
                }
                onChange={(e) => setCompanyName(e.target.value)}
                className="border-border bg-surface-elevated text-foreground placeholder:text-foreground-muted focus:ring-accent w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2"
              />
              <button
                type="submit"
                disabled={
                  ui.kind === "submitting" ||
                  ui.kind === "awaiting" ||
                  !companyName.trim() ||
                  (lines.length > 0 && confirmBusy)
                }
                className="bg-accent hover:bg-accent-hover text-foreground focus:ring-accent rounded-lg px-4 py-3 font-medium transition-colors focus:ring-2 focus:outline-none disabled:opacity-50"
              >
                {ui.kind === "submitting" || ui.kind === "awaiting"
                  ? "Working…"
                  : "Analyze"}
              </button>
            </form>
          )}

        {lines.length > 0 && (
          <div className="relative flex gap-6">
            <div
              className="min-w-0 flex-1"
              aria-live="polite"
              aria-relevant="additions text"
            >
              <ul className="flex flex-col gap-3">
                {phaseSourceLines.map((line) => (
                  <li
                    key={line.id}
                    role="listitem"
                    className="border-border bg-surface-elevated/60 grc-fp-line-enter rounded-lg border p-3"
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="bg-surface-overlay text-foreground-secondary rounded px-2 py-0.5 text-xs font-medium">
                        {line.phaseChip}
                      </span>
                      {bulkEdit || editingId === line.id ? (
                        <input
                          className="border-border bg-surface-base text-foreground focus:ring-accent min-w-[12rem] flex-1 rounded border px-2 py-1 text-sm outline-none focus:ring-2"
                          value={
                            bulkEdit
                              ? lineText(line)
                              : editingId === line.id
                                ? editDraft
                                : overrides[line.id] ?? `${line.title}: ${line.detail}`
                          }
                          disabled={confirmBusy}
                          onChange={(e) => {
                            const val = e.target.value;
                            const def = `${line.title}: ${line.detail}`;
                            if (bulkEdit) {
                              setOverrides((o) => {
                                const next = { ...o };
                                if (val.trim() === def.trim()) delete next[line.id];
                                else next[line.id] = val;
                                return next;
                              });
                              setEdited((eMap) => {
                                const next = { ...eMap };
                                if (val.trim() === def.trim()) next[line.id] = false;
                                return next;
                              });
                              return;
                            }
                            if (editingId === line.id) setEditDraft(val);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (!bulkEdit && editingId === line.id)
                                saveOverride(line.id, line);
                            }
                          }}
                          aria-label={`Edit ${line.phaseChip}`}
                        />
                      ) : (
                        <p className="min-w-0 flex-1 text-sm leading-relaxed">
                          {lineText(line)}
                        </p>
                      )}

                      {!bulkEdit && editingId !== line.id && !confirmBusy && (
                        <>
                          <div
                            ref={(el) => {
                              if (sourcesPopover === line.id) {
                                popoverContainerRef.current = el;
                              }
                            }}
                            className="relative flex items-center gap-1"
                          >
                            <button
                              type="button"
                              className="relative inline-flex"
                              aria-label={`AI confidence for ${line.phaseChip}`}
                              aria-expanded={sourcesPopover === line.id}
                              onMouseEnter={() => {
                                setConfTooltipVisible(true);
                                if (
                                  typeof window !== "undefined" &&
                                  sessionStorage.getItem(TOOLTIP_SESSION_KEY) !== "1"
                                ) {
                                  sessionStorage.setItem(TOOLTIP_SESSION_KEY, "1");
                                  setShowFirstSessionTip(true);
                                }
                              }}
                              onMouseLeave={() => {
                                setConfTooltipVisible(false);
                                setShowFirstSessionTip(false);
                              }}
                              onClick={() =>
                                setSourcesPopover((p) =>
                                  p === line.id ? null : line.id
                                )
                              }
                            >
                              {showFirstSessionTip && confTooltipVisible && (
                                <span className="bg-surface-overlay pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-[10px] text-foreground shadow-md">
                                  AI confidence — click to see sources
                                </span>
                              )}
                              <ConfidenceChip
                                value={Math.round(line.slice.confidence * 100)}
                              />
                            </button>
                            {sourcesPopover === line.id && (
                              <div
                                className="border-border bg-surface-overlay absolute top-full right-0 z-20 mt-2 max-w-xs rounded-lg border p-3 text-left shadow-lg"
                                role="dialog"
                                aria-label="Sources"
                              >
                                <p className="text-foreground-secondary mb-2 text-xs font-medium uppercase tracking-wide">
                                  Sources
                                </p>
                                <ul className="text-foreground list-disc pl-4 text-sm">
                                  {line.slice.sources.map((s) => (
                                    <li key={s}>{s}</li>
                                  ))}
                                </ul>
                                <button
                                  type="button"
                                  className="text-foreground-muted hover:text-foreground mt-3 text-xs underline"
                                  onClick={() => setSourcesPopover(null)}
                                >
                                  Close
                                </button>
                              </div>
                            )}
                          </div>

                          <span className="text-foreground-secondary font-mono text-[11px]">
                            {line.slice.sources[0]}
                          </span>

                          <button
                            type="button"
                            className="text-accent hover:text-accent-hover text-xs font-medium underline"
                            onClick={() => {
                              setEditingId(line.id);
                              setEditDraft(lineText(line));
                            }}
                          >
                            Override
                          </button>
                        </>
                      )}

                      {edited[line.id] && (
                        <span className="bg-status-warn-bg text-status-warn rounded px-2 py-0.5 text-[10px] font-semibold uppercase">
                          Edited
                        </span>
                      )}
                      {bulkEdit && (
                        <button
                          type="button"
                          disabled={
                            confirmBusy ||
                            !canRemoveFingerprintStreamLine(
                              line.id,
                              allStreamLineIds,
                              removedLineIds
                            )
                          }
                          className="text-foreground-muted hover:text-status-fail disabled:text-foreground-muted disabled:opacity-40 px-1 text-lg leading-none"
                          aria-label={`Remove ${line.phaseChip} line`}
                          title={
                            !canRemoveFingerprintStreamLine(
                              line.id,
                              allStreamLineIds,
                              removedLineIds
                            )
                              ? "At least one line must stay in this category."
                              : undefined
                          }
                          onClick={() =>
                            setRemovedLineIds((prev) =>
                              prev.includes(line.id) ? prev : [...prev, line.id]
                            )
                          }
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <PhaseProgressArc activePhase={activePhase} />
          </div>
        )}

        {streamComplete && (
          <footer className="flex flex-col gap-3 pt-4">
            {confirmError && (
              <p className="text-status-fail text-sm" role="alert">
                {confirmError}
              </p>
            )}
            <button
              type="button"
              disabled={confirmBusy}
              className="bg-accent hover:bg-accent-hover text-foreground focus:ring-accent w-full rounded-lg py-3 font-semibold focus:ring-2 focus:outline-none disabled:opacity-60"
              onClick={() => void confirmFingerprint()}
            >
              {confirmBusy ? "Saving…" : confirmLabel}
            </button>
            <button
              type="button"
              disabled={confirmBusy}
              className="text-foreground-secondary hover:text-foreground text-center text-sm underline disabled:opacity-50"
              onClick={() => {
                setBulkEdit((b) => {
                  const next = !b;
                  if (b && !next) {
                    const nextEdited: Record<string, boolean> = {};
                    for (const line of lines) {
                      const def = `${line.title}: ${line.detail}`;
                      const cur = overrides[line.id] ?? def;
                      if (cur.trim() !== def.trim()) nextEdited[line.id] = true;
                    }
                    setEdited((e) => ({ ...e, ...nextEdited }));
                  }
                  return next;
                });
                setEditingId(null);
              }}
            >
              Edit anything before proceeding
            </button>
          </footer>
        )}
      </div>
    </main>
  );
}
