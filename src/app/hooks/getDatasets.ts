// src/app/api/datasets/route.ts
import fs from "fs";
import path from "path";

export async function GET() {
  const basePath = path.join(process.cwd(), "public/datasets");

  const datasets = fs.readdirSync(basePath).map((dataset) => {
    const datasetPath = path.join(basePath, dataset);

    // Tasks are subfolders
    const tasks = fs
      .readdirSync(datasetPath)
      .filter((file) =>
        fs.statSync(path.join(datasetPath, file)).isDirectory()
      );

    // Dataset description file
    const descriptionFile = path.join(basePath, `${dataset}.txt`);
    let description = "";
    if (fs.existsSync(descriptionFile)) {
      description = fs.readFileSync(descriptionFile, "utf-8").trim();
    }

    return {
      name: dataset,
      tasks,
      description,
    };
  });

  return Response.json(datasets);
}
