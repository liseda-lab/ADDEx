import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export async function GET() {
  const dirPath = path.join(process.cwd(), "public", "data");
  const files = fs.readdirSync(dirPath);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  return NextResponse.json(jsonFiles);
}
