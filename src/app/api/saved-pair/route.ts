import { NextRequest, NextResponse } from "next/server";
import { loadSavedPair } from "../_lib/rexSearch";

export async function GET(req: NextRequest) {
  const dataset = req.nextUrl.searchParams.get("dataset");
  const task = req.nextUrl.searchParams.get("task");
  const persona = req.nextUrl.searchParams.get("persona");
  const source = req.nextUrl.searchParams.get("source");
  const target = req.nextUrl.searchParams.get("target");

  if (!dataset || !task || !persona || !source || !target) {
    return NextResponse.json(
      { pair: null, error: "dataset, task, persona, source and target are required" },
      { status: 400 }
    );
  }

  try {
    const pair = loadSavedPair(dataset, task, persona, source, target);

    if (!pair) {
      return NextResponse.json({ pair: null });
    }

    return NextResponse.json({
      pair: {
        ...pair,
        source,
        target,
      },
    });
  } catch (err) {
    console.error("Failed to load saved pair:", err);
    return NextResponse.json(
      { pair: null, error: "Failed to load saved hypothesis" },
      { status: 500 }
    );
  }
}
