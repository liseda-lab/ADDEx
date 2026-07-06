import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { spawn, type ChildProcess } from "child_process";
import {
  loadRexRuntimeConfig,
  loadSavedPair,
  persistSavedPairVerbalization,
  REX_ROOT,
  resolveWindowsBash,
  type SavedPair,
  type SavedPath,
} from "../_lib/rexSearch";
import { stripScoreMentions } from "@/app/hooks/verbalization";
// FIFO QUEUE IMPLEMENTATION
import { cancelQueuedJob, enqueueJob, getJob, queuePosition, touchJob } from "../_lib/heavyQueue";

// FIFO QUEUE IMPLEMENTATION
// Track live verb subprocesses so the DELETE endpoint can kill them when a
// user navigates away mid-generation. Persisted on globalThis so a Next.js
// dev hot-reload doesn't orphan the registry while the child is still alive.
type VerbChildRegistry = Map<string, ChildProcess>;
const verbChildRegistry: VerbChildRegistry =
  (globalThis as { __addexVerbChildRegistry?: VerbChildRegistry }).__addexVerbChildRegistry ??
  new Map<string, ChildProcess>();
if (!(globalThis as { __addexVerbChildRegistry?: VerbChildRegistry }).__addexVerbChildRegistry) {
  (globalThis as { __addexVerbChildRegistry?: VerbChildRegistry }).__addexVerbChildRegistry =
    verbChildRegistry;
}

export const runtime = "nodejs";

type GlobalExplanationBody = {
  dataset?: string;
  task?: string;
  persona?: string;
  source?: string;
  target?: string;
  visiblePathIds?: string[];
  visibleLCAs?: string[];
  forceRefresh?: boolean;
};

// FIFO QUEUE IMPLEMENTATION
// Result the verb runner returns through the heavy-job queue. Stored on the
// queue's Job<T> so GET handlers can read it back.
type VerbResult = {
  explanation: string;
  pathCount: number;
  source: "saved" | "generated";
};

const DEFAULT_RUNNING_MESSAGE =
  "Generating an integrated explanation from the visible graph paths...";

function resolveEndpointNameFromPaths(
  paths: Array<{ nodes?: Array<{ id?: string }> }>,
  fallback: string,
  position: "first" | "last"
) {
  for (const path of paths) {
    const nodes = path.nodes ?? [];
    if (!Array.isArray(nodes) || nodes.length === 0) {
      continue;
    }

    const node = position === "first" ? nodes[0] : nodes[nodes.length - 1];
    const name = node?.id?.trim();
    if (name) return name;
  }

  return fallback.includes("::") ? fallback.split("::")[0] : fallback;
}

function sanitizeExplanationIdentifiers(
  explanation: string,
  rawSource: string,
  rawTarget: string,
  sourceDisplay: string,
  targetDisplay: string
) {
  let cleaned = explanation;

  if (rawSource && sourceDisplay && rawSource !== sourceDisplay) {
    cleaned = cleaned.split(rawSource).join(sourceDisplay);
  }
  if (rawTarget && targetDisplay && rawTarget !== targetDisplay) {
    cleaned = cleaned.split(rawTarget).join(targetDisplay);
  }

  cleaned = cleaned.replace(/\b([A-Za-z][A-Za-z\s/_-]*)::[A-Za-z0-9:._-]+\b/g, "$1");
  cleaned = stripScoreMentions(cleaned);
  return cleaned;
}

function validateBody(body: GlobalExplanationBody) {
  const { dataset, task, persona, source, target, visiblePathIds } = body;
  if (!dataset || !task || !persona || !source || !target) {
    return "dataset, task, persona, source and target are required";
  }

  if (!Array.isArray(visiblePathIds) || visiblePathIds.length === 0) {
    return "At least one visible path must be provided";
  }

  return null;
}

// FIFO QUEUE IMPLEMENTATION
// `jobId` lets DELETE find the child process to kill when the user navigates
// away. The runner registers/deregisters the child on this registry around
// the subprocess lifetime; on cancellation the kill triggers child.on("exit"
// or "error") which rejects the Promise normally.
function runGlobalExplanation(payload: Record<string, unknown>, jobId: string) {
  return new Promise<string>((resolve, reject) => {
    const startedAt = Date.now();
    const commandArgs = ["run", "python", "code/tools/generate_global_explanation.py"];
    const child =
      process.platform === "win32"
        ? (() => {
            const bashPath = resolveWindowsBash();
            if (!bashPath) {
              throw new Error("No Windows bash executable was found. Install Git Bash or MSYS2 bash.");
            }
            return spawn(bashPath, ["-lc", `uv ${commandArgs.join(" ")}`], {
              cwd: REX_ROOT,
              stdio: ["pipe", "pipe", "pipe"],
              windowsHide: true,
            });
          })()
        : spawn("uv", commandArgs, {
            cwd: REX_ROOT,
            stdio: ["pipe", "pipe", "pipe"],
          });
    // FIFO QUEUE IMPLEMENTATION
    verbChildRegistry.set(jobId, child);

    let stdout = "";
    let stderr = "";
    let stdoutTail = "";
    let stderrTail = "";
    const heartbeat = setInterval(() => {
      console.log("[GlobalExplanation] Child still running.", {
        pid: child.pid,
        elapsedMs: Date.now() - startedAt,
      });
    }, 15000);

    console.log("[GlobalExplanation] Spawned child process.", {
      pid: child.pid,
      command: process.platform === "win32" ? `bash -lc uv ${commandArgs.join(" ")}` : `uv ${commandArgs.join(" ")}`,
    });

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      stdoutTail = (stdoutTail + text).slice(-4000);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      stderrTail = (stderrTail + text).slice(-8000);
    });

    child.on("error", (error) => {
      clearInterval(heartbeat);
      // FIFO QUEUE IMPLEMENTATION
      verbChildRegistry.delete(jobId);
      console.log("[GlobalExplanation] Child process emitted error.", {
        pid: child.pid,
        elapsedMs: Date.now() - startedAt,
        error: error.message,
      });
      reject(error);
    });

    child.on("exit", (code, signal) => {
      clearInterval(heartbeat);
      // FIFO QUEUE IMPLEMENTATION
      verbChildRegistry.delete(jobId);
      console.log("[GlobalExplanation] Child process exited.", {
        pid: child.pid,
        code,
        signal,
        elapsedMs: Date.now() - startedAt,
        stdoutTail,
        stderrTail,
      });
      if (code === 0) {
        resolve(stdout);
        return;
      }

      // FIFO QUEUE IMPLEMENTATION
      // Treat SIGTERM/SIGKILL as a cancellation, not a failure. The DELETE
      // endpoint kills the child when a user navigates away; bubbling that
      // up as a generic LLM failure would be misleading.
      if (signal === "SIGTERM" || signal === "SIGKILL") {
        reject(new Error("Verbalization cancelled by user."));
        return;
      }

      reject(
        new Error(
          stderr.trim() ||
            stdout.trim() ||
            `Global explanation generation failed with exit code ${code ?? "unknown"} and signal ${signal ?? "none"}.`
        )
      );
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

// FIFO QUEUE IMPLEMENTATION
// Stable jobId for verbalization dedup. Two callers requesting the same
// verbalization for the same visible-paths set share one queue slot. We
// include forceRefresh so a manual refresh isn't deduped against a normal
// auto-fetch (different intent, different prompt freshness).
function buildVerbJobId(
  body: Required<Pick<GlobalExplanationBody, "dataset" | "task" | "persona" | "source" | "target">> & {
    visiblePathIds: string[];
    forceRefresh: boolean;
  }
): string {
  const visibleSorted = [...body.visiblePathIds].sort().join(",");
  return crypto
    .createHash("sha1")
    .update(
      `${body.dataset}|${body.task}|${body.persona}|${body.source}|${body.target}|${visibleSorted}|${body.forceRefresh ? "refresh" : "auto"}`
    )
    .digest("hex")
    .slice(0, 16);
}

// FIFO QUEUE IMPLEMENTATION
// Compose the user-facing message based on queue position. Position >= 1
// means there are other heavy jobs (REx or verb) ahead; show queue-aware
// copy. Position 0 keeps the existing "Generating an integrated explanation"
// helper so the UI doesn't change behaviour when the user is next up.
function describeVerbJobMessage(jobId: string): string {
  const position = queuePosition(jobId);
  if (position >= 1) {
    const noun = position === 1 ? "user" : "users";
    return `Generating explanations for ${position} other ${noun}. Yours is next in line.`;
  }
  return DEFAULT_RUNNING_MESSAGE;
}

// FIFO QUEUE IMPLEMENTATION
// The runner that the queue dispatches when this verb job's slot opens.
// Captures the work that used to live inline in POST: spawn the Python
// subprocess, sanitize identifiers, optionally persist to saved_models.
async function executeVerbJob(args: {
  jobId: string;
  body: Required<Pick<GlobalExplanationBody, "dataset" | "task" | "persona" | "source" | "target">> & {
    visiblePathIds: string[];
    visibleLCAs: string[];
    forceRefresh: boolean;
  };
  pair: SavedPair;
  filteredPaths: SavedPath[];
  isFullPairSelection: boolean;
}): Promise<VerbResult> {
  const { jobId, body, pair, filteredPaths, isFullPairSelection } = args;

  const sourceDisplay = resolveEndpointNameFromPaths(filteredPaths, body.source, "first");
  const targetDisplay = resolveEndpointNameFromPaths(filteredPaths, body.target, "last");

  const runtimeConfig = loadRexRuntimeConfig(body.dataset, body.task, body.persona);
  console.log("[GlobalExplanation] Generating with runtime config.", {
    agentic_ai_enabled: runtimeConfig.agentic_ai_enabled,
    persona_path: runtimeConfig.persona_path,
    llm_api: runtimeConfig.llm_api,
    llm_model: runtimeConfig.llm_model,
    local_model: "Qwen/Qwen3-1.7B",
    isFullPairSelection,
  });

  const raw = await runGlobalExplanation(
    {
      dataset: body.dataset,
      task: body.task,
      persona: body.persona,
      source: body.source,
      target: body.target,
      paths: filteredPaths,
      visibleLCAs: body.visibleLCAs ?? [],
      agentic_ai_enabled: runtimeConfig.agentic_ai_enabled,
      persona_path: runtimeConfig.persona_path,
      llm_api: runtimeConfig.llm_api,
      llm_model: runtimeConfig.llm_model,
      local_model: "Qwen/Qwen3-1.7B",
    },
    // FIFO QUEUE IMPLEMENTATION
    jobId
  );

  const parsed = JSON.parse(raw) as { explanation?: string };
  if (!parsed.explanation) {
    throw new Error("No explanation was returned by the LLM.");
  }

  const cleanedGeneratedExplanation = sanitizeExplanationIdentifiers(
    parsed.explanation,
    body.source,
    body.target,
    sourceDisplay,
    targetDisplay
  );

  // Persist the first-time generation (no existing verbalization AND the
  // request is not a manual refresh) so the default-of-3 explanation
  // becomes the saved one. Manual "New Verbalization" refreshes with a
  // user-picked subset of paths are ephemeral and do NOT overwrite the
  // stored full-pair default.
  const isInitialAutoGeneration =
    !pair.verbalization?.trim() && !body.forceRefresh;
  if (isInitialAutoGeneration || (isFullPairSelection && body.forceRefresh)) {
    console.log("[GlobalExplanation] Persisting generated verbalization to saved_models.", {
      reason: isInitialAutoGeneration ? "initial-auto" : "full-pair-refresh",
    });
    persistSavedPairVerbalization(
      body.dataset,
      body.task,
      body.persona,
      body.source,
      body.target,
      cleanedGeneratedExplanation
    );
  }

  return {
    explanation: cleanedGeneratedExplanation,
    pathCount: filteredPaths.length,
    source: "generated",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GlobalExplanationBody;
    console.log("[GlobalExplanation] Request received.", body);
    const validationError = validateBody(body);
    if (validationError) {
      console.log("[GlobalExplanation] Validation failed:", validationError);
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const pair = loadSavedPair(
      body.dataset!,
      body.task!,
      body.persona!,
      body.source!,
      body.target!
    );

    if (!pair) {
      console.log("[GlobalExplanation] Saved pair not found.");
      return NextResponse.json({ error: "Saved hypothesis not found." }, { status: 404 });
    }

    let filteredPaths = pair.paths.filter((path) => body.visiblePathIds!.includes(path.id));

    // Stale-state fallback: the frontend guards against sending an empty
    // `visiblePathIds`, so a zero-match filter means the UI is holding IDs
    // that don't exist in the current paths.json (re-ran search, rebuilt
    // pair, etc.). Verbalize the whole pair instead of 400-ing the user.
    if (filteredPaths.length === 0 && pair.paths.length > 0) {
      console.warn(
        "[GlobalExplanation] visiblePathIds did not match any saved path; falling back to all paths.",
        {
          pairId: pair.id,
          requestedIds: body.visiblePathIds,
          savedIds: pair.paths.map((p) => p.id),
        }
      );
      filteredPaths = pair.paths;
    }

    const sourceDisplay = resolveEndpointNameFromPaths(filteredPaths, body.source!, "first");
    const targetDisplay = resolveEndpointNameFromPaths(filteredPaths, body.target!, "last");

    console.log("[GlobalExplanation] Pair loaded.", {
      pairId: pair.id,
      totalPaths: pair.paths.length,
      filteredPaths: filteredPaths.length,
      hasSavedVerbalization: Boolean(pair.verbalization?.trim()),
    });
    if (filteredPaths.length === 0) {
      return NextResponse.json(
        { error: "This hypothesis has no saved paths to verbalize." },
        { status: 400 }
      );
    }

    const isFullPairSelection =
      body.visiblePathIds!.length === pair.paths.length &&
      pair.paths.every((path) => body.visiblePathIds!.includes(path.id));

    // Return the saved verbalization for ANY non-refresh request when one
    // exists in paths.json, the saved explanation was generated from the
    // default selection and should be reused regardless of how many paths
    // are currently visible. A manual "New Verbalization" click
    // (forceRefresh=true) bypasses this and regenerates.
    if (!body.forceRefresh && pair.verbalization?.trim()) {
      console.log("[GlobalExplanation] Returning saved verbalization.");
      const cleanedSavedExplanation = sanitizeExplanationIdentifiers(
        pair.verbalization,
        body.source!,
        body.target!,
        sourceDisplay,
        targetDisplay
      );
      return NextResponse.json({
        status: "completed",
        explanation: cleanedSavedExplanation,
        pathCount: filteredPaths.length,
        source: "saved",
      });
    }

    // FIFO QUEUE IMPLEMENTATION
    // Cache miss (or forceRefresh): hand the work off to the heavy-job queue
    // so two simultaneous verb requests don't both spawn Python subprocesses
    // (each loading the 1.7B model) and OOM the host. Returns a jobId; the
    // client polls /api/global-explanation?jobId=... until completion.
    const required = {
      dataset: body.dataset!,
      task: body.task!,
      persona: body.persona!,
      source: body.source!,
      target: body.target!,
      visiblePathIds: body.visiblePathIds!,
      visibleLCAs: body.visibleLCAs ?? [],
      forceRefresh: Boolean(body.forceRefresh),
    };
    const jobId = buildVerbJobId(required);

    enqueueJob<VerbResult>(jobId, "verb", () =>
      executeVerbJob({
        // FIFO QUEUE IMPLEMENTATION
        jobId,
        body: required,
        pair,
        filteredPaths,
        isFullPairSelection,
      })
    );

    const job = getJob(jobId);
    return NextResponse.json({
      status: job?.status ?? "queued",
      jobId,
      message: describeVerbJobMessage(jobId),
    });
  } catch (error) {
    console.error("Failed to start global explanation:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start the global explanation.",
      },
      { status: 500 }
    );
  }
}

// FIFO QUEUE IMPLEMENTATION
// Status polling endpoint. The verb POST returns {jobId, status} on cache
// miss; the SumSideMenu hook polls this GET until status is "completed" or
// "failed". `touchJob` keeps the reaper from declaring the job orphaned.
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json(
      {
        status: "missing",
        jobId,
        error: "No verbalization job was found for this id.",
      },
      { status: 404 }
    );
  }

  touchJob(jobId);

  if (job.status === "completed") {
    const result = job.result as VerbResult | undefined;
    return NextResponse.json({
      status: "completed",
      jobId,
      explanation: result?.explanation ?? "",
      pathCount: result?.pathCount ?? 0,
      source: result?.source ?? "generated",
    });
  }

  if (job.status === "failed" || job.status === "cancelled") {
    return NextResponse.json({
      status: "failed",
      jobId,
      error: job.error ?? "Verbalization failed.",
    });
  }

  return NextResponse.json({
    status: job.status,
    jobId,
    message: describeVerbJobMessage(jobId),
  });
}

// FIFO QUEUE IMPLEMENTATION
// Abort an in-flight verb job. Called by the client when the user navigates
// away mid-generation: cancels the queue slot if the job is still queued,
// and kills the running Python subprocess if it has already started, so the
// 8GB host doesn't keep burning cycles on a verbalization no one is waiting
// for.
export async function DELETE(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: "jobId is required" },
      { status: 400 }
    );
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json(
      { ok: false, status: "not_found", message: "No verbalization job was found for this id." },
      { status: 404 }
    );
  }

  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    return NextResponse.json({
      ok: true,
      status: "already_finished",
      message: "Job already finished.",
    });
  }

  // Cancel the queued slot first so a not-yet-dispatched job never starts.
  const cancelled = cancelQueuedJob(jobId);

  // If the runner already dispatched, kill the Python subprocess. The exit
  // handler in runGlobalExplanation translates SIGTERM/SIGKILL into a
  // "Verbalization cancelled by user." rejection, which the queue records
  // as job.error and surfaces via GET as status=failed.
  const child = verbChildRegistry.get(jobId);
  if (child && !child.killed) {
    try {
      if (process.platform === "win32") {
        child.kill();
      } else {
        child.kill("SIGTERM");
        // Escalate to SIGKILL after 3s if the process didn't honour SIGTERM
        // (Python LLM inference doesn't always check signals between tokens).
        setTimeout(() => {
          if (child && !child.killed) {
            try {
              child.kill("SIGKILL");
            } catch {
              /* no-op */
            }
          }
        }, 3000);
      }
    } catch (error) {
      console.error("Failed to kill verb child process:", error);
    }
    verbChildRegistry.delete(jobId);
  }

  return NextResponse.json({
    ok: true,
    status: "cancelled",
    queueWasCancelled: cancelled,
    message: "Verbalization cancelled.",
  });
}
