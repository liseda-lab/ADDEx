import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn, spawnSync, type ChildProcess } from "child_process";
// FIFO QUEUE IMPLEMENTATION
import { enqueueJob, queuePosition } from "./heavyQueue";

export type SavedPath = {
  id: string;
  score: Record<string, number>;
  nodes: Array<{ id: string; type: string }>;
  edges: Array<{ source: string; target: string; label: string; type?: "NE" | "LCA" }>;
  lowest_common_ancestors?: Record<string, string[]>;
  warning?: string;
  reasoning?: string;
};

export type SavedPair = {
  id: string;
  verbalization?: string;
  paths: SavedPath[];
  warning?: string;
  source?: string;
  target?: string;
};

export const NO_VALID_PATHS_WARNING =
  "Unfortunately, no paths were found between this pair.\nTry a different pair, or switch dataset/task.";

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type ExplanationJob = {
  jobId: string;
  pairId: string;
  dataset: string;
  task: string;
  persona: string;
  source: string;
  target: string;
  status: JobStatus;
  message: string;
  configPath: string;
  logPath: string;
  statusPath: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
};

export const REX_ROOT = path.join(process.cwd(), "rex");
const JOB_ROOT = path.join(REX_ROOT, "runtime_jobs");
const jobRegistry: Map<string, boolean> =
  (globalThis as { __rexJobRegistry?: Map<string, boolean> }).__rexJobRegistry ??
  new Map<string, boolean>();

if (!(globalThis as { __rexJobRegistry?: Map<string, boolean> }).__rexJobRegistry) {
  (globalThis as { __rexJobRegistry?: Map<string, boolean> }).__rexJobRegistry = jobRegistry;
}

type ChildRegistry = Map<string, ChildProcess>;
const childProcessRegistry: ChildRegistry =
  (globalThis as { __rexChildRegistry?: ChildRegistry }).__rexChildRegistry ??
  new Map<string, ChildProcess>();

if (!(globalThis as { __rexChildRegistry?: ChildRegistry }).__rexChildRegistry) {
  (globalThis as { __rexChildRegistry?: ChildRegistry }).__rexChildRegistry = childProcessRegistry;
}

const cancelledJobs: Set<string> =
  (globalThis as { __rexCancelledJobs?: Set<string> }).__rexCancelledJobs ??
  new Set<string>();

if (!(globalThis as { __rexCancelledJobs?: Set<string> }).__rexCancelledJobs) {
  (globalThis as { __rexCancelledJobs?: Set<string> }).__rexCancelledJobs = cancelledJobs;
}

export const CANCELLED_BY_USER_MESSAGE = "Search cancelled by user.";

export const buildPairId = (source: string, target: string) => `${source} - ${target}`;

export const getPathsJsonPath = (dataset: string, task: string, persona: string) =>
  path.join(REX_ROOT, "saved_models", dataset, task, persona, "paths.json");

// One-file-per-pair layout. The persona folder holds a `pairs/` subdirectory
// where each pair is stored as its own JSON file. This replaces the previous
// single big paths.json (which grew unbounded and broke Node's 512 MB string
// limit on OREGANO). Reads and writes are now O(1) per pair.
const PAIRS_DIRNAME = "pairs";

export const getPairsDir = (
  dataset: string,
  task: string,
  persona: string
) => path.join(REX_ROOT, "saved_models", dataset, task, persona, PAIRS_DIRNAME);

// Convert "COMPOUND:699 - PROTEIN:921" to a filesystem-safe filename:
// "COMPOUND_699__PROTEIN_921.json". Colons and the " - " separator are
// flattened to underscores so the name is portable across OSes.
//
// For pair IDs that produce a name longer than the filesystem's per-component
// limit (typically 255 bytes), fall back to a deterministic hash so the file
// can still be read/written. Without this fallback, pairs with long IDs
// (e.g., PrimeKG drug-disease pairs whose disease is a concatenation of
// many MONDO group IDs) hit ENAMETOOLONG and could never be cached, forcing
// a fresh REx run on every request.
const PAIR_FILENAME_LIMIT = 220;
export function pairIdToFilename(pairId: string): string {
  const safe = pairId
    .split(" - ")
    .map((part) => part.replace(/[:\s]/g, "_"))
    .join("__");
  if (safe.length + 5 <= PAIR_FILENAME_LIMIT) {
    return `${safe}.json`;
  }
  const prefix = safe.slice(0, 60);
  const hash = crypto.createHash("sha256").update(pairId).digest("hex").slice(0, 16);
  return `${prefix}__h_${hash}.json`;
}

export const getPairFilePath = (
  dataset: string,
  task: string,
  persona: string,
  pairId: string
) => path.join(getPairsDir(dataset, task, persona), pairIdToFilename(pairId));

export function resolveWindowsBash() {
  const candidates = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
    "C:\\msys64\\usr\\bin\\bash.exe",
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

export type RexRuntimeConfig = {
  agentic_ai_enabled: boolean;
  persona_path: string;
  llm_api: boolean;
  llm_model: string;
  local_model: string;
};

type SavedPairsFile = {
  pairs?: SavedPair[];
};

function stripShellQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function stripUtf8Bom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function readJsonFile<T>(filePath: string): T {
  const text = stripUtf8Bom(fs.readFileSync(filePath, "utf-8"));
  return JSON.parse(text) as T;
}

function normalizePathForCompare(filePath: string) {
  return path.resolve(filePath).replace(/\\/g, "/").toLowerCase();
}

function isPathInsideRoot(targetPath: string, allowedRoot: string) {
  const target = normalizePathForCompare(targetPath);
  const root = normalizePathForCompare(allowedRoot);
  return target === root || target.startsWith(`${root}/`);
}

function removeDirIfInsideRoot(targetPath: string, allowedRoot: string) {
  if (!fs.existsSync(targetPath)) return;
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(allowedRoot);
  if (!isPathInsideRoot(resolvedTarget, resolvedRoot)) return;
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}

function resolveConfigValue(configRelativePath: string, key: string) {
  const configAbsolutePath = path.join(REX_ROOT, configRelativePath);
  if (!fs.existsSync(configAbsolutePath)) return null;

  const lines = fs.readFileSync(configAbsolutePath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    if (match[1] !== key) continue;
    return stripShellQuotes(match[2]);
  }

  return null;
}

function resolveJobOutputPathsJson(configRelativePath: string, jobId: string) {
  const configuredBaseOutputDir = resolveConfigValue(configRelativePath, "base_output_dir");
  if (!configuredBaseOutputDir) return null;

  const outputBaseDir = path.resolve(REX_ROOT, configuredBaseOutputDir);
  if (!isPathInsideRoot(outputBaseDir, REX_ROOT)) return null;

  return path.join(outputBaseDir, jobId, "paths.json");
}

function pathSignature(pathEntry: SavedPath) {
  const nodes = (pathEntry.nodes ?? [])
    .map((node) => `${node.id}::${node.type}`)
    .join("|");
  const edges = (pathEntry.edges ?? [])
    .map((edge) => `${edge.source}->${edge.target}:${edge.label}:${edge.type ?? ""}`)
    .join("|");
  const lcas = Object.entries(pathEntry.lowest_common_ancestors ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => `${key}=>${(values ?? []).join(",")}`)
    .join("|");

  return `${nodes}__${edges}__${lcas}`;
}

function getMaxPathId(paths: SavedPath[]) {
  return paths.reduce((max, entry) => {
    const match = entry.id?.match(/^path_(\d+)$/i);
    if (!match) return max;
    const value = Number.parseInt(match[1], 10);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
}

function mergeOutputPathsIntoSavedModels(
  dataset: string,
  task: string,
  persona: string,
  configRelativePath: string,
  jobId: string
) {
  const outputJsonPath = resolveJobOutputPathsJson(configRelativePath, jobId);
  if (!outputJsonPath || !fs.existsSync(outputJsonPath)) {
    return { merged: false, addedPathCount: 0, outputDir: null as string | null };
  }

  const outputJson = readJsonFile<SavedPairsFile>(outputJsonPath);
  const outputPairs = outputJson.pairs ?? [];
  if (outputPairs.length === 0) {
    return { merged: false, addedPathCount: 0, outputDir: path.dirname(outputJsonPath) };
  }

  const pairsDir = getPairsDir(dataset, task, persona);
  fs.mkdirSync(pairsDir, { recursive: true });

  let addedPathCount = 0;

  for (const outputPair of outputPairs) {
    const outputPairPaths = outputPair.paths ?? [];
    const pairFile = getPairFilePath(dataset, task, persona, outputPair.id);

    if (!fs.existsSync(pairFile)) {
      fs.writeFileSync(pairFile, JSON.stringify(outputPair, null, 2), "utf-8");
      addedPathCount += outputPairPaths.length;
      continue;
    }

    // Existing pair: merge new paths, dedupe by signature, assign incremental
    // ids so the file accumulates explanations across runs instead of
    // overwriting them.
    const savedPair = readJsonFile<SavedPair>(pairFile);
    if (!savedPair.paths) {
      savedPair.paths = [];
    }

    const existingSignatures = new Set(
      savedPair.paths.map((entry) => pathSignature(entry))
    );
    let maxPathId = getMaxPathId(savedPair.paths);
    let addedToPair = 0;

    for (const candidate of outputPairPaths) {
      const signature = pathSignature(candidate);
      if (existingSignatures.has(signature)) continue;

      maxPathId += 1;
      savedPair.paths.push({
        ...candidate,
        id: `path_${maxPathId}`,
      });
      existingSignatures.add(signature);
      addedToPair += 1;
    }

    if (addedToPair > 0) {
      fs.writeFileSync(
        pairFile,
        JSON.stringify(savedPair, null, 2),
        "utf-8"
      );
      addedPathCount += addedToPair;
    }
  }

  return {
    merged: addedPathCount > 0,
    addedPathCount,
    outputDir: path.dirname(outputJsonPath),
  };
}

function upsertNoPathsWarningPair(
  dataset: string,
  task: string,
  persona: string,
  source: string,
  target: string
) {
  const pairId = buildPairId(source, target);
  const pairsDir = getPairsDir(dataset, task, persona);
  fs.mkdirSync(pairsDir, { recursive: true });
  const pairFile = getPairFilePath(dataset, task, persona, pairId);

  // Preserve any existing verbalization on the pair; force the warning +
  // empty paths so the UI shows the no-paths state consistently.
  const existing: SavedPair | null = fs.existsSync(pairFile)
    ? readJsonFile<SavedPair>(pairFile)
    : null;

  const warningPair: SavedPair = {
    ...(existing ?? {}),
    id: pairId,
    verbalization: existing?.verbalization ?? "",
    warning: NO_VALID_PATHS_WARNING,
    paths: [],
  };

  fs.writeFileSync(pairFile, JSON.stringify(warningPair, null, 2), "utf-8");
}

export function loadRexRuntimeConfig(dataset: string, task: string, persona: string): RexRuntimeConfig {
  const relativeConfigPath = resolveConfigRelativePath(dataset, task, persona);
  const absoluteConfigPath = path.join(REX_ROOT, relativeConfigPath);
  const defaults: RexRuntimeConfig = {
    agentic_ai_enabled: false,
    persona_path: "",
    llm_api: false,
    llm_model: "qwen",
    local_model: "Qwen/Qwen3.5-9B",
  };

  if (!fs.existsSync(absoluteConfigPath)) {
    return defaults;
  }

  const lines = fs.readFileSync(absoluteConfigPath, "utf-8").split(/\r?\n/);
  const values = new Map<string, string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    values.set(match[1], stripShellQuotes(match[2]));
  }

  const readBool = (key: string, fallback: boolean) => {
    const raw = values.get(key);
    if (raw == null || raw === "") {
      return fallback;
    }
    return raw === "1" || raw.toLowerCase() === "true";
  };

  const readString = (key: string, fallback: string) => {
    const raw = values.get(key);
    if (raw == null || raw === "" || raw === "None") {
      return fallback;
    }
    return raw;
  };

  return {
    agentic_ai_enabled: readBool("agentic_ai_enabled", defaults.agentic_ai_enabled),
    persona_path: readString("persona_path", defaults.persona_path),
    llm_api: readBool("llm_api", defaults.llm_api),
    llm_model: readString("llm_model", defaults.llm_model),
    local_model: readString("local_model", defaults.local_model),
  };
}

const getTestFilePath = (dataset: string, task: string) =>
  path.join(process.cwd(), "public", "datasets", dataset, task, "test.txt");

const normalizeEntityId = (value: string) =>
  value.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ");

export function loadSavedPair(
  dataset: string,
  task: string,
  persona: string,
  source: string,
  target: string
): SavedPair | null {
  const pairId = buildPairId(source, target);
  const filePath = getPairFilePath(dataset, task, persona, pairId);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const pair = readJsonFile<SavedPair>(filePath);
  return {
    ...pair,
    source,
    target,
  };
}

export function persistSavedPairVerbalization(
  dataset: string,
  task: string,
  persona: string,
  source: string,
  target: string,
  verbalization: string
) {
  const pairId = buildPairId(source, target);
  const filePath = getPairFilePath(dataset, task, persona, pairId);
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const pair = readJsonFile<SavedPair>(filePath);
  const updated: SavedPair = { ...pair, verbalization };
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf-8");
  return true;
}

export function ensurePairInTestFile(
  dataset: string,
  task: string,
  source: string,
  target: string
) {
  const testFilePath = getTestFilePath(dataset, task);
  const cleanSource = normalizeEntityId(source);
  const cleanTarget = normalizeEntityId(target);

  fs.mkdirSync(path.dirname(testFilePath), { recursive: true });

  const existingLines = fs.existsSync(testFilePath)
    ? fs.readFileSync(testFilePath, "utf-8").split(/\r?\n/).filter(Boolean)
    : [];
  const relation =
    existingLines
      .map((entry) => entry.split("\t")[1]?.trim())
      .find(Boolean) ??
    (task === "drug_target" ? "CbG" : "CtD");
  const line = `${cleanSource}\t${relation}\t${cleanTarget}`;

  const currentLine = existingLines[0]?.trim() ?? "";
  if (currentLine === line && existingLines.length === 1) {
    return { replaced: false, testFilePath, line };
  }

  fs.writeFileSync(testFilePath, `${line}\n`, "utf-8");
  return { replaced: true, testFilePath, line };
}

function normalizePersonaName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveConfigRelativePath(dataset: string, task: string, persona: string) {
  const configDir = path.join(REX_ROOT, "configs", dataset, task);

  if (!fs.existsSync(configDir)) {
    throw new Error(`Config directory not found: ${configDir}`);
  }

  const files = fs.readdirSync(configDir).filter((file) => file.endsWith(".sh"));
  const exactMatch = files.find((file) => file === `${persona}.sh`);
  if (exactMatch) {
    return path.posix.join("configs", dataset, task, exactMatch);
  }

  const target = normalizePersonaName(persona);
  const fuzzyMatch = files.find((file) => normalizePersonaName(file.replace(/\.sh$/i, "")) === target);

  if (!fuzzyMatch) {
    throw new Error(`Config file not found for persona "${persona}" in ${configDir}`);
  }

  return path.posix.join("configs", dataset, task, fuzzyMatch);
}

function getJobId(dataset: string, task: string, persona: string, source: string, target: string) {
  return crypto
    .createHash("sha1")
    .update(`${dataset}|${task}|${persona}|${source}|${target}`)
    .digest("hex")
    .slice(0, 16);
}

function getJobPaths(jobId: string) {
  const jobDir = path.join(JOB_ROOT, jobId);
  return {
    jobDir,
    statusPath: path.join(jobDir, "status.json"),
    logPath: path.join(jobDir, "run.log"),
    scriptPath: path.join(jobDir, "run-job.ps1"),
  };
}

export function readJob(jobId: string): ExplanationJob | null {
  const { statusPath } = getJobPaths(jobId);
  if (!fs.existsSync(statusPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(statusPath, "utf-8")) as ExplanationJob;
}

function isStaleStartupJob(job: ExplanationJob) {
  const ageMs = Date.now() - new Date(job.updatedAt).getTime();
  const logExists = fs.existsSync(job.logPath);

  if (job.status === "queued" && ageMs > 10000) {
    return true;
  }

  if (job.status === "running" && !logExists && ageMs > 15000) {
    return true;
  }

  return false;
}

function writeJob(job: ExplanationJob) {
  fs.mkdirSync(path.dirname(job.statusPath), { recursive: true });
  fs.writeFileSync(job.statusPath, JSON.stringify(job, null, 2), "utf-8");
}

function updateJob(
  jobId: string,
  updates: Partial<Pick<ExplanationJob, "status" | "message" | "completedAt">>
) {
  const current = readJob(jobId);
  if (!current) return;

  const next: ExplanationJob = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeJob(next);
}

// FIFO QUEUE IMPLEMENTATION
// Returns a Promise that resolves when the REx subprocess reaches a terminal
// state (success, error, no-paths, or cancellation). The returned Promise is
// what the heavy-job queue awaits to know its single slot is free again. The
// "running" status update happens here (not in startExplanationJob) so the
// file-based status accurately reflects "queued" while the queue holds this
// job behind others.
async function runRexJob(job: ExplanationJob): Promise<void> {
  if (jobRegistry.has(job.jobId)) {
    return;
  }

  jobRegistry.set(job.jobId, true);
  updateJob(job.jobId, {
    status: "running",
    message: "This is the first time someone is running this pair, it may take a few minutes.",
  });

  fs.mkdirSync(path.dirname(job.logPath), { recursive: true });
  const stdoutFd = fs.openSync(job.logPath, "a");
  const stderrPath = path.join(path.dirname(job.logPath), "run.stderr.log");
  const stderrFd = fs.openSync(stderrPath, "a");

  let child: ChildProcess;
  try {
    child =
      process.platform === "win32"
        ? (() => {
            const bashPath = resolveWindowsBash();

            if (!bashPath) {
              throw new Error(
                "No Windows bash executable was found. Install Git Bash or MSYS2 bash."
              );
            }

            return spawn(bashPath, ["-lc", `uv run bash run.sh "${job.configPath}" "${job.jobId}"`], {
              cwd: REX_ROOT,
              stdio: ["ignore", stdoutFd, stderrFd],
              windowsHide: true,
              // PYTHONUNBUFFERED makes Python flush stdout/stderr line-by-line
              // so run.log updates live instead of waiting for large buffer
              // flushes. Essential for seeing progress of long jobs.
              env: { ...process.env, PYTHONUNBUFFERED: "1" },
            });
          })()
        : spawn("uv", ["run", "bash", "run.sh", job.configPath, job.jobId], {
            cwd: REX_ROOT,
            stdio: ["ignore", stdoutFd, stderrFd],
            env: { ...process.env, PYTHONUNBUFFERED: "1" },
          });
  } catch (error) {
    updateJob(job.jobId, {
      status: "failed",
      message:
        error instanceof Error
          ? error.message
          : "Failed to start REx job.",
      completedAt: new Date().toISOString(),
    });
    jobRegistry.delete(job.jobId);
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);
    removeDirIfInsideRoot(getJobPaths(job.jobId).jobDir, JOB_ROOT);
    return;
  }

  childProcessRegistry.set(job.jobId, child);

  // FIFO QUEUE IMPLEMENTATION
  // Resolve the outer Promise only after the subprocess actually terminates,
  // so the queue holds its slot for the full lifetime of this REx run.
  await new Promise<void>((resolve) => {
    const childRef = child;
    childRef.on("error", (error) => {
      updateJob(job.jobId, {
        status: "failed",
        message: `Failed to start REx job: ${error.message}`,
        completedAt: new Date().toISOString(),
      });
      jobRegistry.delete(job.jobId);
      childProcessRegistry.delete(job.jobId);
      fs.closeSync(stdoutFd);
      fs.closeSync(stderrFd);
      removeDirIfInsideRoot(getJobPaths(job.jobId).jobDir, JOB_ROOT);
      resolve();
    });

    childRef.on("exit", (code) => {
    const completedAt = new Date().toISOString();
    const { jobDir } = getJobPaths(job.jobId);
    let outputDirToCleanup: string | null = null;
    // Always remove the per-job runtime_jobs folder once the job reaches a
    // terminal state. The authoritative outcome lives in saved_models/ (as a
    // pair file or a no-paths warning pair), and the GET endpoint checks that
    // first, so the job folder is no longer needed for the UI. Leaving it
    // would accumulate debris on hosted deployments from crashes and
    // no-paths results.
    let shouldCleanupRuntimeJobDir = true;
    const wasCancelled = cancelledJobs.has(job.jobId);

    try {
      if (wasCancelled) {
        const outputJsonPath = resolveJobOutputPathsJson(job.configPath, job.jobId);
        outputDirToCleanup = outputJsonPath ? path.dirname(outputJsonPath) : null;
        updateJob(job.jobId, {
          status: "failed",
          message: CANCELLED_BY_USER_MESSAGE,
          completedAt,
        });
      } else if (code === 0) {
        const mergeResult = mergeOutputPathsIntoSavedModels(
          job.dataset,
          job.task,
          job.persona,
          job.configPath,
          job.jobId
        );
        outputDirToCleanup = mergeResult.outputDir;
      } else {
        const outputJsonPath = resolveJobOutputPathsJson(job.configPath, job.jobId);
        outputDirToCleanup = outputJsonPath ? path.dirname(outputJsonPath) : null;
      }

      if (!wasCancelled) {
        const pair = loadSavedPair(job.dataset, job.task, job.persona, job.source, job.target);

        if (pair) {
          updateJob(job.jobId, {
            status: "completed",
            message: "Explanation generated successfully.",
            completedAt,
          });
        } else if (code === 0) {
          upsertNoPathsWarningPair(
            job.dataset,
            job.task,
            job.persona,
            job.source,
            job.target
          );
          updateJob(job.jobId, {
            status: "failed",
            message: NO_VALID_PATHS_WARNING,
            completedAt,
          });
        } else {
          updateJob(job.jobId, {
            status: "failed",
            message: `REx failed while generating this explanation (exit code ${code ?? "unknown"}).`,
            completedAt,
          });
        }
      }
    } catch (error) {
      updateJob(job.jobId, {
        status: "failed",
        message:
          error instanceof Error
            ? `REx finished but failed to merge/save paths: ${error.message}`
            : "REx finished but failed to merge/save paths.",
        completedAt,
      });
    } finally {
      if (outputDirToCleanup) {
        removeDirIfInsideRoot(outputDirToCleanup, REX_ROOT);
      }
      if (shouldCleanupRuntimeJobDir) {
        removeDirIfInsideRoot(jobDir, JOB_ROOT);
      }
      jobRegistry.delete(job.jobId);
      childProcessRegistry.delete(job.jobId);
      cancelledJobs.delete(job.jobId);
      fs.closeSync(stdoutFd);
      fs.closeSync(stderrFd);
      // FIFO QUEUE IMPLEMENTATION
      // Release the queue slot once the subprocess (and its cleanup) is fully done.
      resolve();
    }
    });
  });
}

/**
 * Find OS-level pids whose argv mentions this job id (covers cases where
 * the in-memory childProcessRegistry has been cleared, e.g., after a
 * Next.js dev-server restart, leaving orphan REx processes behind).
 */
function findOrphanPidsByJobId(jobId: string): number[] {
  if (process.platform === "win32") return [];
  try {
    const result = spawnSync("ps", ["-A", "-o", "pid=", "-o", "args="], {
      encoding: "utf8",
      timeout: 4000,
    });
    if (result.status !== 0 || !result.stdout) return [];
    const myPid = process.pid;
    const pids: number[] = [];
    for (const line of result.stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (!trimmed.includes(jobId)) continue;
      // Match either `--job_id <jobId>` (python trainer) or the bash
      // wrapper invocation (`run.sh <config> <jobId>`).
      if (
        !trimmed.includes(`--job_id ${jobId}`) &&
        !trimmed.includes(`run.sh`)
      ) {
        continue;
      }
      const match = trimmed.match(/^\s*(\d+)\s/);
      if (!match) continue;
      const pid = Number(match[1]);
      if (!Number.isFinite(pid) || pid === myPid) continue;
      pids.push(pid);
    }
    return pids;
  } catch (error) {
    console.error("Failed to scan for orphan REx processes:", error);
    return [];
  }
}

function killPidWithEscalation(pid: number) {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* already gone */
    return;
  }
  setTimeout(() => {
    try {
      process.kill(pid, 0); // probe
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }, 3000);
}

function killOrphansByJobId(jobId: string) {
  const pids = findOrphanPidsByJobId(jobId);
  if (pids.length === 0) return 0;
  console.warn(
    `[rexSearch] Killing ${pids.length} orphan REx process(es) for job ${jobId}: ${pids.join(", ")}`
  );
  for (const pid of pids) killPidWithEscalation(pid);
  return pids.length;
}

// Delete a saved-pair file if (and only if) it carries the no-paths-warning
// shape — i.e. an abandoned/empty record. Used after cancellation so a stale
// "no paths" entry left over from a prior aborted run doesn't short-circuit
// the next retry of the same pair via the loadSavedPair cache check.
function deleteNoPathsWarningPair(
  dataset: string,
  task: string,
  persona: string,
  source: string,
  target: string
) {
  const pairId = buildPairId(source, target);
  const pairFile = getPairFilePath(dataset, task, persona, pairId);
  if (!fs.existsSync(pairFile)) return;
  try {
    const pair = readJsonFile<SavedPair>(pairFile);
    const looksLikeNoPaths =
      Array.isArray(pair.paths) &&
      pair.paths.length === 0 &&
      typeof pair.warning === "string" &&
      pair.warning.length > 0;
    if (looksLikeNoPaths) {
      fs.unlinkSync(pairFile);
    }
  } catch (error) {
    console.error("Failed to clean up no-paths warning pair file:", error);
  }
}

export function cancelJob(jobId: string): {
  ok: boolean;
  status: "cancelled" | "already_finished" | "not_found";
  message: string;
} {
  const job = readJob(jobId);
  if (!job) {
    return { ok: false, status: "not_found", message: "Job not found." };
  }

  if (job.status === "completed" || job.status === "failed") {
    childProcessRegistry.delete(jobId);
    return {
      ok: true,
      status: "already_finished",
      message: "Job already finished.",
    };
  }

  cancelledJobs.add(jobId);
  // Drop any stale no-paths warning file for this pair so a retry actually
  // re-runs REx instead of being short-circuited by the cache check in
  // loadSavedPair → isNoPathsWarningPair.
  deleteNoPathsWarningPair(
    job.dataset,
    job.task,
    job.persona,
    job.source,
    job.target
  );
  const child = childProcessRegistry.get(jobId);

  if (child && !child.killed) {
    try {
      if (process.platform === "win32") {
        child.kill();
      } else {
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) {
            try {
              child.kill("SIGKILL");
            } catch {
              /* no-op */
            }
          }
        }, 3000);
      }
    } catch (error) {
      console.error("Failed to kill REx child process:", error);
    }
    // Also kill any sibling/grand-child OS processes (e.g., the bash
    // wrapper or the python trainer if signal forwarding fails).
    killOrphansByJobId(jobId);
  } else {
    // No registered child, could be an orphan from a previous server
    // process. Scan and kill any matching pid before tearing down state.
    killOrphansByJobId(jobId);
    updateJob(jobId, {
      status: "failed",
      message: CANCELLED_BY_USER_MESSAGE,
      completedAt: new Date().toISOString(),
    });
    jobRegistry.delete(jobId);
    childProcessRegistry.delete(jobId);
    cancelledJobs.delete(jobId);
    removeDirIfInsideRoot(getJobPaths(jobId).jobDir, JOB_ROOT);
  }

  return {
    ok: true,
    status: "cancelled",
    message: CANCELLED_BY_USER_MESSAGE,
  };
}

export function startExplanationJob(
  dataset: string,
  task: string,
  persona: string,
  source: string,
  target: string
) {
  const jobId = getJobId(dataset, task, persona, source, target);
  const existingJob = readJob(jobId);
  const readyPair = loadSavedPair(dataset, task, persona, source, target);

  if (readyPair) {
    return { kind: "ready" as const, pair: readyPair, job: existingJob };
  }

  if (existingJob && (existingJob.status === "queued" || existingJob.status === "running")) {
    if (!isStaleStartupJob(existingJob)) {
      return { kind: "running" as const, job: existingJob };
    }
  }

  // Defensive: if any orphan REx process is still alive for this jobId
  // (e.g., previous run leaked because the dev-server restarted), kill it
  // before launching a new one, otherwise they accumulate and contend
  // for the same dataset files.
  killOrphansByJobId(jobId);

  ensurePairInTestFile(dataset, task, source, target);

  const configPath = resolveConfigRelativePath(dataset, task, persona);
  const staleOutputJsonPath = resolveJobOutputPathsJson(configPath, jobId);
  if (staleOutputJsonPath) {
    removeDirIfInsideRoot(path.dirname(staleOutputJsonPath), REX_ROOT);
  }

  const { jobDir, statusPath, logPath, scriptPath } = getJobPaths(jobId);
  removeDirIfInsideRoot(jobDir, JOB_ROOT);
  fs.mkdirSync(jobDir, { recursive: true });

  const now = new Date().toISOString();
  const job: ExplanationJob = {
    jobId,
    pairId: buildPairId(source, target),
    dataset,
    task,
    persona,
    source,
    target,
    status: "queued",
    message: "This is the first time someone is running this pair, it may take a few minutes.",
    configPath,
    logPath,
    statusPath,
    startedAt: now,
    updatedAt: now,
  };

  writeJob(job);
  fs.writeFileSync(scriptPath, "", "utf-8");
  // FIFO QUEUE IMPLEMENTATION
  // Hand the spawn off to the global heavy-job queue so two cache misses don't
  // run REx subprocesses in parallel and OOM the host. The queue dedups by
  // jobId, so concurrent callers for the same pair share one run.
  void enqueueJob(jobId, "rex", () => runRexJob(job));

  return { kind: "running" as const, job };
}

// FIFO QUEUE IMPLEMENTATION
// Resolve the user-facing message for a queued/running REx job. When the
// job is sitting behind others in the FIFO line we override the default
// "first time someone is running this pair" with a queue-position message
// so the UI tells the user how many people are ahead. Returns the original
// message untouched for any other state.
export function describeRexJobMessage(jobId: string, defaultMessage: string): string {
  const position = queuePosition(jobId);
  if (position >= 1) {
    const noun = position === 1 ? "user" : "users";
    return `Generating explanations for ${position} other ${noun}. Yours is next in line.`;
  }
  return defaultMessage;
}
