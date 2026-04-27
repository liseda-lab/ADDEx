import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import {
  loadRexRuntimeConfig,
  loadSavedPair,
  persistSavedPairVerbalization,
  REX_ROOT,
  resolveWindowsBash,
} from "../_lib/rexSearch";

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

function runGlobalExplanation(payload: Record<string, unknown>) {
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
      console.log("[GlobalExplanation] Child process emitted error.", {
        pid: child.pid,
        elapsedMs: Date.now() - startedAt,
        error: error.message,
      });
      reject(error);
    });

    child.on("exit", (code, signal) => {
      clearInterval(heartbeat);
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
      return NextResponse.json({ error: "Saved pair not found." }, { status: 404 });
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
        { error: "This pair has no saved paths to verbalize." },
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
        explanation: cleanedSavedExplanation,
        pathCount: filteredPaths.length,
        source: "saved",
      });
    }

    const runtimeConfig = loadRexRuntimeConfig(body.dataset!, body.task!, body.persona!);
    console.log("[GlobalExplanation] Generating with runtime config.", {
      agentic_ai_enabled: runtimeConfig.agentic_ai_enabled,
      persona_path: runtimeConfig.persona_path,
      llm_api: runtimeConfig.llm_api,
      llm_model: runtimeConfig.llm_model,
      local_model: "Qwen/Qwen3-1.7B",
      isFullPairSelection,
    });
    console.log("[GlobalExplanation] Attempting generation.", {
      llm_api: runtimeConfig.llm_api,
      llm_model: runtimeConfig.llm_model,
      local_model: "Qwen/Qwen3-1.7B",
    });
    const raw = await runGlobalExplanation({
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
    });

    const parsed = JSON.parse(raw) as { explanation?: string };
    if (!parsed.explanation) {
      console.log("[GlobalExplanation] Generator returned no explanation.");
      return NextResponse.json({ error: "No explanation was returned by the LLM." }, { status: 502 });
    }

    const cleanedGeneratedExplanation = sanitizeExplanationIdentifiers(
      parsed.explanation,
      body.source!,
      body.target!,
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
        body.dataset!,
        body.task!,
        body.persona!,
        body.source!,
        body.target!,
        cleanedGeneratedExplanation
      );
    }

    console.log("[GlobalExplanation] Generation completed successfully.");
    return NextResponse.json({
      explanation: cleanedGeneratedExplanation,
      pathCount: filteredPaths.length,
      source: "generated",
    });
  } catch (error) {
    console.error("Failed to generate global explanation:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate the global explanation.",
      },
      { status: 500 }
    );
  }
}
