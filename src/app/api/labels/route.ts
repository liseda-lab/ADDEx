import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export type LabelNode = {
  code: string;
  name: string;
  type: string;
};

export type LabelsByType = Record<string, LabelNode[]>;

const normalizeEntityId = (value: string) => {
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  return trimmed.replace(/\s+/g, " ");
};

const inferTypeFromId = (
  entityId: string,
  dataset: string,
  task: string,
  role: "source" | "target"
) => {
  if (entityId.includes("::")) {
    return entityId.split("::", 1)[0];
  }

  const normalizedId = entityId.toLowerCase();

  if (
    normalizedId.startsWith("disease") ||
    normalizedId.startsWith("doid") ||
    normalizedId.startsWith("mondo")
  ) {
    return "Disease";
  }

  if (task === "drug_target") {
    if (role === "source") {
      return dataset.toLowerCase() === "primekg" ? "Drug" : "Compound";
    }
    return dataset.toLowerCase() === "hetionet" ? "Gene" : "Target";
  }

  if (task === "drug_repurposing") {
    return role === "source"
      ? dataset.toLowerCase() === "primekg"
        ? "Drug"
        : "Compound"
      : "Disease";
  }

  return role === "source" ? "Source" : "Target";
};

const addLabelNode = (
  map: LabelsByType,
  seenCodes: Set<string>,
  code: string,
  name: string,
  type: string
) => {
  if (!code || !type || seenCodes.has(code)) return;

  if (!map[type]) map[type] = [];
  map[type].push({ code, name, type });
  seenCodes.add(code);
};

export async function GET(req: NextRequest) {
  const dataset = req.nextUrl.searchParams.get("dataset");
  const task = req.nextUrl.searchParams.get("task");

  if (!dataset || !task) {
    return NextResponse.json(
      { labelsByType: {}, error: "dataset and task are required" },
      { status: 400 }
    );
  }

  // Construct path to your TSV file
  const filePath = path.join(
    process.cwd(),
    "public",
    "datasets",
    dataset,
    task,
    "graph_labels.tsv"
  );

  try {
    const text = fs.readFileSync(filePath, "utf-8");
    const testFilePath = path.join(
      process.cwd(),
      "public",
      "datasets",
      dataset,
      task,
      "test.txt"
    );

    const lines = text.split("\n").filter(Boolean);
    const map: LabelsByType = {};
    const seenCodes = new Set<string>();

    for (const line of lines) {
      const [rawCode, rawName, rawType] = line.split("\t");
      const code = normalizeEntityId(rawCode ?? "");
      const name = normalizeEntityId(rawName ?? code);
      const type = normalizeEntityId(rawType ?? "");
      addLabelNode(map, seenCodes, code, name, type);
    }

    if (fs.existsSync(testFilePath)) {
      const testText = fs.readFileSync(testFilePath, "utf-8");
      const testLines = testText.split("\n").filter(Boolean);

      for (const line of testLines) {
        const [rawSource, , rawTarget] = line.split("\t");
        const sourceCode = normalizeEntityId(rawSource ?? "");
        const targetCode = normalizeEntityId(rawTarget ?? "");

        addLabelNode(
          map,
          seenCodes,
          sourceCode,
          sourceCode,
          inferTypeFromId(sourceCode, dataset, task, "source")
        );
        addLabelNode(
          map,
          seenCodes,
          targetCode,
          targetCode,
          inferTypeFromId(targetCode, dataset, task, "target")
        );
      }
    }

    for (const type of Object.keys(map)) {
      map[type].sort((left, right) => left.name.localeCompare(right.name));
    }

    return NextResponse.json({ labelsByType: map });
  } catch (err) {
    console.error("Failed to load labels:", err);
    return NextResponse.json(
      { labelsByType: {}, error: "Failed to load labels" },
      { status: 500 }
    );
  }
}
