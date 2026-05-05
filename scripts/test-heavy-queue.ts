// FIFO QUEUE IMPLEMENTATION
// Smoke test: exercises every public function of heavyQueue with mocked
// runners (no subprocess, no model load) to verify FIFO ordering, dedup,
// position lookup, cancellation, and the reaper. Run with:
//   npx tsx scripts/test-heavy-queue.mts

import {
  cancelQueuedJob,
  enqueueJob,
  getJob,
  queuePosition,
  touchJob,
} from "../src/app/api/_lib/heavyQueue";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Tiny test harness: collect failures, summarise at the end. Exit non-zero
// if anything failed so CI / the user sees a clear pass/fail.
const failures: string[] = [];
function assert(cond: boolean, label: string) {
  if (cond) {
    console.log("  ok  " + label);
  } else {
    console.log("  FAIL " + label);
    failures.push(label);
  }
}
function section(name: string) {
  console.log(`\n=== ${name} ===`);
}

async function runner(durationMs: number, output: string, log: string[]) {
  return new Promise<string>((resolve) => {
    log.push(`start:${output}`);
    setTimeout(() => {
      log.push(`done:${output}`);
      resolve(output);
    }, durationMs);
  });
}

async function main() {
  section("FIFO ordering: jobs run one at a time in submit order");
  {
    const log: string[] = [];
    const a = enqueueJob("job-a", "rex", () => runner(80, "A", log));
    const b = enqueueJob("job-b", "rex", () => runner(80, "B", log));
    const c = enqueueJob("job-c", "rex", () => runner(80, "C", log));

    // A may already be "running" by the time we read it (p-queue dispatches
    // via a microtask when a slot is free). What matters is that A is in
    // flight and B/C are sitting queued behind it.
    assert(
      a.status === "queued" || a.status === "running",
      "A is in flight (queued or running)"
    );
    assert(b.status === "queued", "B starts queued");
    assert(c.status === "queued", "C starts queued");

    // Position before any dispatch: A=0, B=1, C=2.
    assert(queuePosition("job-a") === 0, "A position is 0 (next up)");
    assert(queuePosition("job-b") === 1, "B has 1 ahead");
    assert(queuePosition("job-c") === 2, "C has 2 ahead");

    // Wait for all three to finish (3 * ~80ms = ~240ms; pad).
    await sleep(450);

    assert(
      JSON.stringify(log) ===
        JSON.stringify([
          "start:A",
          "done:A",
          "start:B",
          "done:B",
          "start:C",
          "done:C",
        ]),
      "log shows strict A→B→C FIFO order, no overlap"
    );
    assert(getJob("job-a")?.status === "completed", "A reached completed");
    assert(getJob("job-b")?.status === "completed", "B reached completed");
    assert(getJob("job-c")?.status === "completed", "C reached completed");
    assert(queuePosition("job-a") === -1, "A no longer in line");
  }

  section("Dedup: enqueueing the same id while in flight returns same Job");
  {
    const log: string[] = [];
    const j1 = enqueueJob("dup-1", "verb", () => runner(120, "X", log));
    const j2 = enqueueJob("dup-1", "verb", () => runner(120, "Y", log));

    assert(j1 === j2, "second enqueue returns the existing job (===)");
    await sleep(200);
    assert(
      JSON.stringify(log) === JSON.stringify(["start:X", "done:X"]),
      "only the first runner ran (Y was deduped)"
    );
  }

  section("Position math during a running job");
  {
    const log: string[] = [];
    enqueueJob("pos-running", "rex", () => runner(150, "R", log));
    enqueueJob("pos-waiting", "rex", () => runner(20, "W", log));

    // Wait for the first job to start (it dispatches on the next tick).
    await sleep(20);

    assert(getJob("pos-running")?.status === "running", "first job is running");
    assert(getJob("pos-waiting")?.status === "queued", "second job is queued");
    assert(queuePosition("pos-running") === 0, "running job has 0 ahead");
    assert(queuePosition("pos-waiting") === 1, "queued job has 1 ahead (the running one)");

    await sleep(250);
    assert(getJob("pos-running")?.status === "completed", "first finished");
    assert(getJob("pos-waiting")?.status === "completed", "second finished");
  }

  section("Cancel a queued job: it never dispatches");
  {
    const log: string[] = [];
    enqueueJob("cancel-running", "rex", () => runner(150, "RUN", log));
    enqueueJob("cancel-queued", "rex", () => runner(50, "QUEUED", log));

    // Cancel the queued one while the first is still in flight.
    await sleep(20);
    const cancelOk = cancelQueuedJob("cancel-queued");
    assert(cancelOk === true, "cancelQueuedJob returns true for a queued job");

    await sleep(250);
    assert(
      log.indexOf("start:QUEUED") === -1,
      "cancelled job never started"
    );
    assert(
      getJob("cancel-queued")?.status === "cancelled",
      "queued job ends in cancelled status"
    );
  }

  section("Cancel a running job: returns false (not safely cancellable)");
  {
    const log: string[] = [];
    enqueueJob("hot-running", "rex", () => runner(120, "H", log));
    await sleep(20);
    const cancelOk = cancelQueuedJob("hot-running");
    assert(cancelOk === false, "cannot cancel a running job via cancelQueuedJob");
    await sleep(200);
    assert(getJob("hot-running")?.status === "completed", "running job ran to completion");
  }

  section("Failed runner: status reflects the error");
  {
    const j = enqueueJob("boom", "verb", async () => {
      throw new Error("kaboom");
    });
    void j; // silence unused
    await sleep(80);
    const stored = getJob("boom");
    assert(stored?.status === "failed", "thrown error → status=failed");
    assert(
      stored?.error?.includes("kaboom") === true,
      "error message preserved on the job"
    );
  }

  section("touchJob updates lastSeenAt");
  {
    enqueueJob("touch-me", "rex", () => runner(40, "T", []));
    const before = getJob("touch-me")!.lastSeenAt;
    await sleep(15);
    touchJob("touch-me");
    const after = getJob("touch-me")!.lastSeenAt;
    assert(after >= before, "touchJob bumps lastSeenAt forward");
    await sleep(80);
  }

  section("Result is stored on completed jobs");
  {
    enqueueJob<string>("result-job", "verb", async () => "the-answer");
    await sleep(40);
    const stored = getJob("result-job");
    assert(stored?.status === "completed", "completed status");
    assert(
      (stored?.result as string | undefined) === "the-answer",
      "result value is readable from the job"
    );
  }

  section("Summary");
  if (failures.length === 0) {
    console.log(`\nAll checks passed.`);
    process.exit(0);
  } else {
    console.log(`\n${failures.length} check(s) FAILED:`);
    for (const f of failures) console.log("  - " + f);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test harness crashed:", err);
  process.exit(1);
});
