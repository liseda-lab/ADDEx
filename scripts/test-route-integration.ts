// FIFO QUEUE IMPLEMENTATION
// Integration test for the verb route handler. We don't spin up Next.js or
// Python: we seed the heavy-job queue with stub runners and call the GET
// handler directly with a synthetic NextRequest. This catches wiring bugs
// between the queue module and the route (status mapping, queue-position
// message, failure mapping) without needing the runtime stack.
//
// Run with:
//   npx tsx scripts/test-route-integration.ts

import { NextRequest } from "next/server";
import { GET } from "../src/app/api/global-explanation/route";
import { enqueueJob } from "../src/app/api/_lib/heavyQueue";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const failures: string[] = [];
function assert(cond: boolean, label: string) {
  if (cond) console.log("  ok  " + label);
  else {
    console.log("  FAIL " + label);
    failures.push(label);
  }
}
function section(name: string) {
  console.log(`\n=== ${name} ===`);
}

async function callGet(jobId: string | null) {
  const url = jobId
    ? `http://localhost/api/global-explanation?jobId=${encodeURIComponent(jobId)}`
    : `http://localhost/api/global-explanation`;
  const req = new NextRequest(url, { method: "GET" });
  const res = await GET(req);
  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  section("GET without jobId → 400");
  {
    const { status, body } = await callGet(null);
    assert(status === 400, "HTTP 400 returned");
    assert(typeof body.error === "string", "error field present");
  }

  section("GET for unknown jobId → 404 with status=missing");
  {
    const { status, body } = await callGet("does-not-exist-1234");
    assert(status === 404, "HTTP 404 returned");
    assert(body.status === "missing", "status field is 'missing'");
  }

  section("GET while job is running returns running + default message");
  {
    const id = "verb-running-1";
    enqueueJob(id, "verb", async () => {
      await sleep(120);
      return {
        explanation: "running-result",
        pathCount: 3,
        source: "generated" as const,
      };
    });

    // Give the queue a tick to dispatch.
    await sleep(20);
    const { status, body } = await callGet(id);
    assert(status === 200, "HTTP 200 while running");
    assert(
      body.status === "queued" || body.status === "running",
      "status is queued/running"
    );
    assert(typeof body.message === "string", "message field present");
    assert(
      body.message.includes("Generating an integrated explanation") ||
        body.message.includes("Generating explanations for"),
      "message is one of the verb copy variants"
    );

    await sleep(200);
  }

  section("GET after completion returns the runner's result");
  {
    const id = "verb-completes-1";
    enqueueJob(id, "verb", async () => {
      await sleep(40);
      return {
        explanation: "the-final-text",
        pathCount: 7,
        source: "generated" as const,
      };
    });

    await sleep(120);
    const { status, body } = await callGet(id);
    assert(status === 200, "HTTP 200 after completion");
    assert(body.status === "completed", "status is 'completed'");
    assert(body.explanation === "the-final-text", "runner result surfaced as explanation");
    assert(body.pathCount === 7, "runner result surfaced as pathCount");
    assert(body.source === "generated", "runner result surfaced as source");
  }

  section("GET on a failed job returns status=failed with error");
  {
    const id = "verb-fails-1";
    enqueueJob(id, "verb", async () => {
      await sleep(20);
      throw new Error("synthetic-failure");
    });

    await sleep(80);
    const { status, body } = await callGet(id);
    assert(status === 200, "HTTP 200 even on failed job (status field carries it)");
    assert(body.status === "failed", "status is 'failed'");
    assert(
      typeof body.error === "string" && body.error.includes("synthetic-failure"),
      "error message preserved through the route"
    );
  }

  section("Queue-position message: 2 jobs queued behind a running one");
  {
    // Block the queue with a long-running job that holds the slot.
    const blocker = "blocker-rex";
    enqueueJob(blocker, "rex", async () => {
      await sleep(200);
      return "blocker-done";
    });

    // Two verb jobs queued behind the blocker.
    const v1 = "verb-pos-1";
    const v2 = "verb-pos-2";
    enqueueJob(v1, "verb", async () => ({
      explanation: "v1",
      pathCount: 1,
      source: "generated" as const,
    }));
    enqueueJob(v2, "verb", async () => ({
      explanation: "v2",
      pathCount: 1,
      source: "generated" as const,
    }));

    // Let the blocker dispatch.
    await sleep(20);

    const r1 = await callGet(v1);
    assert(
      r1.body.message?.includes("Generating explanations for 1 other user"),
      `v1 sees 'Generating explanations for 1 other user.' (got: ${JSON.stringify(r1.body.message)})`
    );

    const r2 = await callGet(v2);
    assert(
      r2.body.message?.includes("Generating explanations for 2 other users"),
      `v2 sees 'Generating explanations for 2 other users.' (got: ${JSON.stringify(r2.body.message)})`
    );

    // Drain the queue before exiting so the test process doesn't hang on
    // pending timers.
    await sleep(400);
  }

  section("Summary");
  if (failures.length === 0) {
    console.log("\nAll checks passed.");
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
