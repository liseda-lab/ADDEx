// FIFO QUEUE IMPLEMENTATION
// Single-slot FIFO queue that gates every heavy subprocess (REx path search +
// local-LLM verbalization). On the 8GB CPU host both workloads compete for the
// same memory budget; concurrency=1 keeps the box from OOM-ing under multiple
// users. Provides hash-based dedup (multiple callers attach to one job),
// queue-position lookup for the UI ("3 ahead" message), polling-touch reaper
// (drops queued jobs whose caller stopped polling), and a TTL sweep for old
// terminal jobs so the in-memory map doesn't grow forever.

import PQueue from "p-queue";

export type JobKind = "rex" | "verb";
export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface CancelToken {
  cancelled: boolean;
}

export interface Job<T = unknown> {
  id: string;
  kind: JobKind;
  status: JobStatus;
  enqueuedAt: number;
  startedAt?: number;
  finishedAt?: number;
  result?: T;
  error?: string;
  lastSeenAt: number;
  cancelToken: CancelToken;
}

// Persist these across Next.js dev-server hot-reloads via globalThis so a
// single restart of an API route file doesn't orphan in-flight jobs.
type GlobalState = {
  __addexHeavyQueue?: PQueue;
  __addexHeavyJobs?: Map<string, Job>;
  __addexHeavyOrder?: string[];
  __addexHeavyReaper?: NodeJS.Timeout | null;
};
const G = globalThis as GlobalState;

const queue: PQueue =
  G.__addexHeavyQueue ?? new PQueue({ concurrency: 1 });
G.__addexHeavyQueue = queue;

const jobs: Map<string, Job> = G.__addexHeavyJobs ?? new Map();
G.__addexHeavyJobs = jobs;

// Tracks insertion order for position lookup. We mutate it as jobs reach
// terminal state so position() reflects the live FIFO line, not historical
// enqueue order.
const enqueueOrder: string[] = G.__addexHeavyOrder ?? [];
G.__addexHeavyOrder = enqueueOrder;

const REAPER_INTERVAL_MS = 10_000;
const ORPHAN_THRESHOLD_MS = 30_000; // queued + last poll older than this → cancel
const TERMINAL_TTL_MS = 60 * 60 * 1000; // keep completed/failed for 1h

function startReaper(): void {
  if (G.__addexHeavyReaper) return;
  const handle = setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (
        job.status === "queued" &&
        now - job.lastSeenAt > ORPHAN_THRESHOLD_MS
      ) {
        // Caller went away. Mark for cancellation; the runner will see this
        // when it dispatches and short-circuit before spawning anything.
        job.cancelToken.cancelled = true;
      }
      if (
        (job.status === "completed" ||
          job.status === "failed" ||
          job.status === "cancelled") &&
        job.finishedAt &&
        now - job.finishedAt > TERMINAL_TTL_MS
      ) {
        jobs.delete(id);
        const idx = enqueueOrder.indexOf(id);
        if (idx >= 0) enqueueOrder.splice(idx, 1);
      }
    }
  }, REAPER_INTERVAL_MS);
  // Don't keep the Node event loop alive just for the reaper.
  handle.unref?.();
  G.__addexHeavyReaper = handle;
}

/**
 * Add or attach to a heavy job. If a job with the same id is queued or
 * running, the existing job is returned (dedup). Otherwise a new job is
 * enqueued with the given runner. The runner gets a CancelToken which it
 * MAY check to bail out early; for non-cancellable work (REx) the token is
 * checked once before dispatch only.
 */
export function enqueueJob<T>(
  id: string,
  kind: JobKind,
  runner: (cancelToken: CancelToken) => Promise<T>
): Job<T> {
  startReaper();

  const existing = jobs.get(id);
  if (
    existing &&
    (existing.status === "queued" || existing.status === "running")
  ) {
    existing.lastSeenAt = Date.now();
    return existing as Job<T>;
  }

  const job: Job<T> = {
    id,
    kind,
    status: "queued",
    enqueuedAt: Date.now(),
    lastSeenAt: Date.now(),
    cancelToken: { cancelled: false },
  };
  jobs.set(id, job);
  enqueueOrder.push(id);

  void queue.add(async () => {
    if (job.cancelToken.cancelled) {
      job.status = "cancelled";
      job.finishedAt = Date.now();
      const idx = enqueueOrder.indexOf(id);
      if (idx >= 0) enqueueOrder.splice(idx, 1);
      return;
    }
    job.status = "running";
    job.startedAt = Date.now();
    try {
      const result = await runner(job.cancelToken);
      job.result = result;
      job.status = "completed";
    } catch (err) {
      job.error = err instanceof Error ? err.message : String(err);
      job.status = "failed";
    } finally {
      job.finishedAt = Date.now();
      const idx = enqueueOrder.indexOf(id);
      if (idx >= 0) enqueueOrder.splice(idx, 1);
    }
  });

  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/**
 * Number of *other* jobs ahead of `id` in the live FIFO line (queued +
 * the currently-running one, if it isn't `id` itself). Returns 0 when the
 * job is next up or already running. Returns -1 when not tracked.
 *
 * Used by the UI to render "Generating explanations for N other users."
 */
export function queuePosition(id: string): number {
  const idx = enqueueOrder.indexOf(id);
  if (idx < 0) return -1;
  let count = 0;
  for (let i = 0; i < idx; i++) {
    const other = jobs.get(enqueueOrder[i]);
    if (other && (other.status === "queued" || other.status === "running")) {
      count++;
    }
  }
  return count;
}

/**
 * Refresh the lastSeenAt timestamp. The status-poll endpoints call this on
 * every GET so the reaper knows the caller is still listening.
 */
export function touchJob(id: string): void {
  const job = jobs.get(id);
  if (job) job.lastSeenAt = Date.now();
}

/**
 * Mark a queued job for cancellation. Returns true if cancellation took
 * effect (job was still queued). Running jobs are not safely cancellable
 * mid-flight; callers that need hard cancel must use the kind-specific
 * cancellation (e.g., killing the REx child process via cancelJob in
 * rexSearch.ts) on top of this.
 */
export function cancelQueuedJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job) return false;
  if (job.status === "queued") {
    job.cancelToken.cancelled = true;
    return true;
  }
  return false;
}
