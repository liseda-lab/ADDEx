import { NextRequest, NextResponse } from "next/server";
import {
  cancelJob,
  describeRexJobMessage,
  loadSavedPair,
  NO_VALID_PATHS_WARNING,
  readJob,
  startExplanationJob,
} from "../_lib/rexSearch";
// FIFO QUEUE IMPLEMENTATION
import { cancelQueuedJob, touchJob } from "../_lib/heavyQueue";

export const runtime = "nodejs";

type SearchBody = {
  dataset?: string;
  task?: string;
  persona?: string;
  source?: string;
  target?: string;
};

function validateParams(params: SearchBody) {
  const { dataset, task, persona, source, target } = params;

  if (!dataset || !task || !persona || !source || !target) {
    return "dataset, task, persona, source and target are required";
  }

  return null;
}

function isNoPathsWarningPair(pair: { warning?: string; paths?: unknown[] }) {
  // Detect by structure: an entry with no paths and some warning attached is
  // always a "REx ran but found nothing" record, regardless of whether the
  // saved warning text matches the current NO_VALID_PATHS_WARNING constant
  // (older runs may have stored a different wording).
  return (
    Array.isArray(pair.paths) &&
    pair.paths.length === 0 &&
    typeof pair.warning === "string" &&
    pair.warning.length > 0
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SearchBody;
    const error = validateParams(body);

    if (error) {
      return NextResponse.json({ status: "failed", error }, { status: 400 });
    }

    const result = startExplanationJob(
      body.dataset!,
      body.task!,
      body.persona!,
      body.source!,
      body.target!
    );

    if (result.kind === "ready") {
      if (isNoPathsWarningPair(result.pair)) {
        return NextResponse.json({
          status: "failed",
          message: NO_VALID_PATHS_WARNING,
        });
      }

      return NextResponse.json({
        status: "ready",
        pair: result.pair,
      });
    }

    // FIFO QUEUE IMPLEMENTATION
    // Override the message with queue-position info if there are other jobs
    // ahead so the UI can show "Generating explanations for N other users."
    return NextResponse.json({
      status: result.job.status,
      jobId: result.job.jobId,
      message: describeRexJobMessage(result.job.jobId, result.job.message),
    });
  } catch (error) {
    console.error("Failed to start explanation search:", error);
    return NextResponse.json(
      { status: "failed", error: "Failed to start explanation search" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const dataset = req.nextUrl.searchParams.get("dataset") ?? undefined;
  const task = req.nextUrl.searchParams.get("task") ?? undefined;
  const persona = req.nextUrl.searchParams.get("persona") ?? undefined;
  const source = req.nextUrl.searchParams.get("source") ?? undefined;
  const target = req.nextUrl.searchParams.get("target") ?? undefined;
  const jobId = req.nextUrl.searchParams.get("jobId") ?? undefined;

  const error = validateParams({ dataset, task, persona, source, target });
  if (error) {
    return NextResponse.json({ status: "failed", error }, { status: 400 });
  }

  const pair = loadSavedPair(dataset!, task!, persona!, source!, target!);
  if (pair) {
    if (isNoPathsWarningPair(pair)) {
      return NextResponse.json({
        status: "failed",
        message: NO_VALID_PATHS_WARNING,
      });
    }

    return NextResponse.json({
      status: "ready",
      pair,
    });
  }

  if (!jobId) {
    return NextResponse.json({
      status: "missing",
      message: "No running job was found for this pair.",
    });
  }

  const job = readJob(jobId);
  if (!job) {
    return NextResponse.json({
      status: "missing",
      message: "No running job was found for this pair.",
    });
  }

  // FIFO QUEUE IMPLEMENTATION
  // Refresh the polling-touch timestamp so the reaper knows this caller is
  // still listening (and won't drop the job as orphaned).
  touchJob(jobId);

  if (job.status === "completed") {
    return NextResponse.json({
      status: "failed",
      message: "The job finished but the explanation could not be loaded yet. Please try again.",
      jobId: job.jobId,
      completedAt: job.completedAt ?? null,
    });
  }

  return NextResponse.json({
    status: job.status,
    jobId: job.jobId,
    // FIFO QUEUE IMPLEMENTATION: prefer queue-position message when applicable.
    message: describeRexJobMessage(job.jobId, job.message),
    completedAt: job.completedAt ?? null,
  });
}

export async function DELETE(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: "jobId is required" },
      { status: 400 }
    );
  }

  // FIFO QUEUE IMPLEMENTATION
  // Cancel the queued slot too (if the job is still waiting). Running jobs
  // are not safely cancellable mid-flight, but cancelJob below also kills
  // the child process when one exists.
  cancelQueuedJob(jobId);
  const result = cancelJob(jobId);
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
