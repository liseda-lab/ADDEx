import fs from "fs";
import path from "path";

type DatasetEntry = {
  name: string;
  tasks: string[];
  description: string;
};

let cachedDatasets: DatasetEntry[] | null = null;

function loadDatasets(): DatasetEntry[] {
  const basePath = path.join(process.cwd(), "public/datasets");
  if (!fs.existsSync(basePath)) {
    return [];
  }

  const datasets = fs
    .readdirSync(basePath)
    .map((dataset) => {
      const datasetPath = path.join(basePath, dataset);
      if (!fs.statSync(datasetPath).isDirectory()) return null;

      const files = fs.readdirSync(datasetPath);
      const tasks = files.filter(
        (file) =>
          fs.statSync(path.join(datasetPath, file)).isDirectory() &&
          file.toLowerCase() !== "links"
      );

      const descriptionPath = path.join(datasetPath, `${dataset}.txt`);
      let description = "";
      if (fs.existsSync(descriptionPath)) {
        description = fs.readFileSync(descriptionPath, "utf-8");
      }

      return {
        name: dataset,
        tasks,
        description,
      };
    })
    .filter(Boolean) as DatasetEntry[];

  return datasets;
}

export async function GET() {
  try {
    if (!cachedDatasets) {
      cachedDatasets = loadDatasets();
    }
    return Response.json(cachedDatasets);
  } catch {
    return Response.json([]);
  }
}
