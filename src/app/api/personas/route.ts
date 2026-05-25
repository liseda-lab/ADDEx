import fs from "fs";
import path from "path";

// Parse persona content
function parsePersona(content: string) {
  const getField = (label: string) => {
    const escapedLabel = label.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    const regex = new RegExp(
      `${escapedLabel}:?\\s*(?:…)?\\s*([\\s\\S]*?)(?=\\n(?:Name|Tagline|Profile|Also values(?:…|\\.{3})|Background note):|$)`,
      "m"
    );
    return content.match(regex)?.[1]?.trim() || "";
  };

  return {
    name: getField("Name"),
    tagline: getField("Tagline"),
    profile: getField("Profile"),
    alsoValues: getField("Also values"),
  };
}

let cachedPersonas:
  | Array<{
      id: string;
      name: string;
      tagline: string;
      profile: string;
      alsoValues: string;
    }>
  | null = null;

function loadPersonas() {
  const basePath = path.join(process.cwd(), "public/personas");
  const personaFiles = fs.readdirSync(basePath);
  return personaFiles.map((file) => {
    const content = fs.readFileSync(path.join(basePath, file), "utf-8");
    const parsed = parsePersona(content);
    return {
      id: file.replace(".txt", ""),
      ...parsed,
    };
  });
}

export async function GET() {
  if (!cachedPersonas) {
    cachedPersonas = loadPersonas();
  }
  return new Response(JSON.stringify(cachedPersonas), {
    headers: { "Content-Type": "application/json" },
  });
}
