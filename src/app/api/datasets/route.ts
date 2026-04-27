import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const basePath = path.join(process.cwd(), "public/datasets");

    if (!fs.existsSync(basePath)) {
      return Response.json([]);
    }

    const datasets = fs.readdirSync(basePath).map((dataset) => {
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
    });

    return Response.json(datasets.filter(Boolean));
  } catch {
    return Response.json([]);
  }
}
