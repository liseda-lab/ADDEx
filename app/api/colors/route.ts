import { NextResponse } from "next/server";
import typeColors from "../../../../styles/typeColors.json";

const DEFAULT_USER = {
  persona: { id: "neutral" },
  nodeColors: typeColors.nodeColors,
};

export async function GET() {
  return NextResponse.json(DEFAULT_USER);
}

export async function POST(req: Request) {
  const incoming = await req.json().catch(() => ({}));
  const user = {
    ...DEFAULT_USER,
    ...(incoming?.persona ? { persona: incoming.persona } : {}),
    ...(incoming?.nodeColors
      ? { nodeColors: { ...DEFAULT_USER.nodeColors, ...incoming.nodeColors } }
      : {}),
  };
  return NextResponse.json({ success: true, user });
}
