import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

type RequestBody = {
  dataset?: string;
  entities?: Array<{
    name?: string;
    type?: string;
  }>;
};

type LinkCategory = "compound" | "disease" | "gene";

type LinkInfo = {
  url: string;
  source?: string;
  externalId?: string;
};

type DatasetLinks = Record<LinkCategory, Map<string, LinkInfo>>;

const cache = new Map<string, DatasetLinks>();

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function mapTypeToCategory(type: string): LinkCategory | null {
  const normalized = normalize(type);
  if (!normalized) return null;

  if (normalized.includes("drug") || normalized.includes("compound")) {
    return "compound";
  }
  if (normalized.includes("disease")) {
    return "disease";
  }
  if (normalized.includes("gene")) {
    return "gene";
  }
  return null;
}

function createEmptyDatasetLinks(): DatasetLinks {
  return {
    compound: new Map<string, LinkInfo>(),
    disease: new Map<string, LinkInfo>(),
    gene: new Map<string, LinkInfo>(),
  };
}

function addMapping(map: Map<string, LinkInfo>, key: string, info: LinkInfo) {
  const normalizedKey = normalize(key);
  if (!normalizedKey || !info.url) return;
  if (!map.has(normalizedKey)) {
    map.set(normalizedKey, info);
  }
}

function buildDatasetLinks(dataset: string): DatasetLinks {
  const cached = cache.get(dataset);
  if (cached) {
    return cached;
  }

  const linksByCategory = createEmptyDatasetLinks();
  const linksDir = path.join(process.cwd(), "public", "datasets", dataset, "links");

  const filesByCategory: Record<LinkCategory, string> = {
    compound: `${dataset}_compound_urls.tsv`,
    disease: `${dataset}_disease_urls.tsv`,
    gene: `${dataset}_gene_urls.tsv`,
  };

  const categories: LinkCategory[] = ["compound", "disease", "gene"];
  for (const category of categories) {
    const filePath = path.join(linksDir, filesByCategory[category]);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line) continue;

      const columns = line.split("\t");
      const id = columns[0]?.trim() ?? "";
      const externalId = columns[1]?.trim() ?? "";
      const source = columns[2]?.trim() ?? "";
      const url = columns[3]?.trim() ?? "";
      const name = columns.slice(4).join("\t").trim();

      if (!url) continue;

      const info: LinkInfo = { url, source, externalId };
      addMapping(linksByCategory[category], id, info);
      addMapping(linksByCategory[category], externalId, info);
      addMapping(linksByCategory[category], name, info);
    }
  }

  cache.set(dataset, linksByCategory);
  return linksByCategory;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const dataset = (body.dataset ?? "").trim();
  const entities = Array.isArray(body.entities) ? body.entities : [];

  if (!dataset) {
    return NextResponse.json({ error: "dataset is required" }, { status: 400 });
  }

  const datasetLinks = buildDatasetLinks(dataset);

  const links: Record<string, LinkInfo> = {};
  for (const entity of entities) {
    const name = typeof entity?.name === "string" ? entity.name.trim() : "";
    const type = typeof entity?.type === "string" ? entity.type : "";
    if (!name || !type) continue;

    const category = mapTypeToCategory(type);
    if (!category) continue;

    const key = `${category}::${normalize(name)}`;
    const info = datasetLinks[category].get(normalize(name));
    if (info) {
      links[key] = info;
    }
  }

  return NextResponse.json({ links });
}
