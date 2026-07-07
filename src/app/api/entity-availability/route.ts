import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  normalizeTypeLabel,
  getDefaultTypes,
  typeMatchesPreference,
} from "../../hooks/taskDefaults";

// "Where is my entity?" lookup. Indexes every graph_labels.tsv under
// public/datasets (one per dataset/task) into a name -> availability map so the
// Guide can answer, for a typed drug/disease, which knowledge graphs contain it
// and under which tasks. "Available" means the entity exists as a node in that
// graph — NOT that a specific pair has a path (that is the pre-computed filter's
// / a first-time run's job). The index is built once per server process and
// cached, since the label files are static.

type Entry = { dataset: string; task: string; type: string };
type IndexRow = { name: string; entries: Entry[] };

// Match the labels route's normalization (trim, strip wrapping quotes, collapse
// whitespace) so names line up with what the search box resolves.
const normalize = (v: string) =>
  v.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ");

// Searchable = the exact node types the search box offers for that (dataset,
// task) — source compounds/drugs plus that dataset's target type — reusing the
// selectors' own getDefaultTypes so this never drifts from what's pickable.
// Crucially it is DATASET-aware: OREGANO's drug-target task uses PROTEIN targets
// (its Gene nodes never appear as targets in train/test/dev), while Hetionet
// uses GENE. Label files carry extra node types (a graph's diseases, OREGANO's
// unused genes, …) that must not count as "available to search".
const isSearchableForTask = (
  rawType: string,
  task: string,
  dataset: string
): boolean => {
  const { source, target } = getDefaultTypes(task, dataset);
  return [...source, ...target].some((t) => typeMatchesPreference(rawType, t));
};

const canonicalType = (rawType: string): string => {
  const n = normalizeTypeLabel(rawType);
  if (n === "compound" || n === "drug") return "Compound";
  if (n === "disease") return "Disease";
  if (n === "gene") return "Gene";
  if (n === "protein") return "Protein";
  if (n === "target") return "Target";
  return rawType;
};

let indexPromise: Promise<Map<string, IndexRow>> | null = null;

async function buildIndex(): Promise<Map<string, IndexRow>> {
  const datasetsRoot = path.join(process.cwd(), "public", "datasets");
  const index = new Map<string, IndexRow>(); // key = lowercased name

  let datasets: string[];
  try {
    datasets = await fs.readdir(datasetsRoot);
  } catch {
    return index;
  }

  for (const dataset of datasets) {
    const datasetDir = path.join(datasetsRoot, dataset);
    let tasks: string[];
    try {
      if (!(await fs.stat(datasetDir)).isDirectory()) continue;
      tasks = await fs.readdir(datasetDir);
    } catch {
      continue;
    }

    for (const task of tasks) {
      const file = path.join(datasetDir, task, "graph_labels.tsv");
      let text: string;
      try {
        text = await fs.readFile(file, "utf-8");
      } catch {
        continue; // not every dataset/task combo exists
      }

      for (const line of text.split("\n")) {
        if (!line) continue;
        const [rawCode, rawName, rawType] = line.split("\t");
        const name = normalize(rawName ?? rawCode ?? "");
        if (!name) continue;
        if (!isSearchableForTask(rawType ?? "", task, dataset)) continue;
        const type = canonicalType(rawType ?? "");
        const key = name.toLowerCase();

        let row = index.get(key);
        if (!row) {
          row = { name, entries: [] };
          index.set(key, row);
        }
        if (
          !row.entries.some(
            (e) => e.dataset === dataset && e.task === task && e.type === type
          )
        ) {
          row.entries.push({ dataset, task, type });
        }
      }
    }
  }

  return index;
}

function getIndex() {
  if (!indexPromise) indexPromise = buildIndex();
  return indexPromise;
}

type GraphOut = {
  dataset: string;
  tasks: string[];
  types: string[];
  // Set when this dataset was added via the gene/protein crossover map: the
  // entity's name in that dataset (Hetionet gene symbol <-> OREGANO protein
  // name), so searching either way surfaces both datasets.
  viaName?: string;
};

// Bidirectional gene<->protein name map, built offline from GOA + NCBI gene_info
// (see gene_crossover.json). Cached per process.
let crossoverPromise: Promise<{
  het2ore: Record<string, string>;
  ore2het: Record<string, string>;
}> | null = null;

function getCrossover() {
  if (!crossoverPromise) {
    crossoverPromise = fs
      .readFile(
        path.join(process.cwd(), "public", "datasets", "gene_crossover.json"),
        "utf-8"
      )
      .then((t) => JSON.parse(t))
      .catch(() => ({ het2ore: {}, ore2het: {} }));
  }
  return crossoverPromise;
}

// Match the crossover map's key normalization (lowercase, alphanumerics only).
const xnorm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const index = await getIndex();
  const LIMIT = 25;
  const CAP = 500;
  const starts: IndexRow[] = [];
  const contains: IndexRow[] = [];

  for (const row of index.values()) {
    const nl = row.name.toLowerCase();
    if (nl.startsWith(q)) {
      if (starts.length < CAP) starts.push(row);
    } else if (nl.includes(q)) {
      if (contains.length < CAP) contains.push(row);
    }
  }

  const byName = (a: IndexRow, b: IndexRow) => a.name.localeCompare(b.name);
  starts.sort(byName);
  contains.sort(byName);
  const rows = [...starts, ...contains].slice(0, LIMIT);

  const results = rows.map((row) => {
    const byDataset = new Map<
      string,
      { dataset: string; tasks: Set<string>; types: Set<string> }
    >();
    for (const e of row.entries) {
      let g = byDataset.get(e.dataset);
      if (!g) {
        g = { dataset: e.dataset, tasks: new Set(), types: new Set() };
        byDataset.set(e.dataset, g);
      }
      if (e.task) g.tasks.add(e.task);
      if (e.type) g.types.add(e.type);
    }
    const graphs: GraphOut[] = [...byDataset.values()].map((g) => ({
      dataset: g.dataset,
      tasks: [...g.tasks],
      types: [...g.types],
    }));
    return { name: row.name, graphs };
  });

  // Crossover: a Hetionet gene and its OREGANO protein have different name
  // strings, so a plain name match only finds one dataset. Add the counterpart
  // (as a drug-target Gene/Protein) so searching either name shows both.
  const crossover = await getCrossover();
  for (const r of results) {
    const key = xnorm(r.name);
    const oreName = crossover.het2ore[key];
    if (oreName && !r.graphs.some((g) => g.dataset === "oregano")) {
      r.graphs.push({
        dataset: "oregano",
        tasks: ["drug_target"],
        types: ["Protein"],
        viaName: oreName,
      });
    }
    const hetSym = crossover.ore2het[key];
    if (hetSym && !r.graphs.some((g) => g.dataset === "hetionet")) {
      r.graphs.push({
        dataset: "hetionet",
        tasks: ["drug_target"],
        types: ["Gene"],
        viaName: hetSym,
      });
    }
  }

  return NextResponse.json({ results });
}
