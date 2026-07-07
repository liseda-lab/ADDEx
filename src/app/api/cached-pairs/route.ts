import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getPairsDir, type SavedPair } from "../_lib/rexSearch";

// Match pairIdToFilename's sanitization (":" and whitespace -> "_").
const sanitize = (code: string) => code.replace(/[:\s]/g, "_");

// Returns the already-computed counterparts for the "show only pre-computed"
// filter: given a sourceCode, the cached targets; given a targetCode, the cached
// sources. A pair is "pre-computed" when its per-pair file exists (paths cached),
// so this is a directory listing + a read of only the matched files — no REx run.
//
// Filenames are "<sanitizedSource>__<sanitizedTarget>.json", so the source side
// is a fast filename-prefix match (catches every pair, including hashed long-id
// ones, since the source always leads). The target side is a filename-suffix
// match, which covers the readable filenames (the vast majority); rare hashed
// long-code targets aren't matched this way and would need a prebuilt index.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dataset = sp.get("dataset");
  const task = sp.get("task");
  const persona = sp.get("persona");
  const sourceCode = sp.get("sourceCode");
  const targetCode = sp.get("targetCode");

  if (!dataset || !task || !persona || (!sourceCode && !targetCode)) {
    return NextResponse.json(
      {
        error:
          "dataset, task, persona and one of sourceCode/targetCode are required",
      },
      { status: 400 }
    );
  }

  const pairsDir = getPairsDir(dataset, task, persona);
  let filenames: string[];
  try {
    filenames = await fs.readdir(pairsDir);
  } catch {
    return NextResponse.json({ endpoints: [] }); // no cache dir -> nothing cached
  }

  const wantTarget = Boolean(sourceCode); // source given -> return targets
  const matches = wantTarget
    ? filenames.filter(
        (f) => f.startsWith(sanitize(sourceCode!) + "__") && f.endsWith(".json")
      )
    : filenames.filter((f) => f.endsWith("__" + sanitize(targetCode!) + ".json"));

  const seenNames = new Set<string>();
  const seenCodes = new Set<string>();
  const endpoints: { name: string; type: string }[] = [];
  const noPathCodes: string[] = [];
  await Promise.all(
    matches.map(async (f) => {
      try {
        const data = JSON.parse(
          await fs.readFile(path.join(pairsDir, f), "utf-8")
        ) as SavedPair;
        const nodes = data.paths?.[0]?.nodes ?? [];
        if (nodes.length >= 2) {
          // Has a real explanation: the counterpart node carries its name.
          const node = wantTarget ? nodes[nodes.length - 1] : nodes[0];
          const name = String(node?.id ?? "");
          const type = String(node?.type ?? "");
          if (name && !seenNames.has(name)) {
            seenNames.add(name);
            endpoints.push({ name, type });
          }
          return;
        }
        // No paths + a warning = "REx ran but found nothing". Keep it so the UI
        // can MARK it rather than hide it (hiding makes it look un-computed and
        // invites a doomed run). There are no nodes, so recover the counterpart
        // from the saved id ("<sourceCode> - <targetCode>"); the client resolves
        // that code back to a display name via graph_labels.
        const warning =
          typeof data.warning === "string" ? data.warning.trim() : "";
        if (!warning) return;
        const parts = (typeof data.id === "string" ? data.id : "").split(" - ");
        if (parts.length !== 2) return;
        const code = (wantTarget ? parts[1] : parts[0]).trim();
        if (code && !seenCodes.has(code)) {
          seenCodes.add(code);
          noPathCodes.push(code);
        }
      } catch {
        /* skip unreadable/partial files */
      }
    })
  );

  return NextResponse.json({ endpoints, noPathCodes });
}
