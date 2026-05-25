export interface DefaultTypePreferences {
  source: string[];
  target: string[];
}

const COMPOUND_DRUG_ALIASES = new Set(["compound", "drug"]);

export const normalizeTypeLabel = (type?: string) =>
  (type ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");

const getAliasGroup = (type?: string) => {
  const normalized = normalizeTypeLabel(type);
  if (COMPOUND_DRUG_ALIASES.has(normalized)) {
    return COMPOUND_DRUG_ALIASES;
  }
  return new Set([normalized]);
};

export const typeMatchesPreference = (type?: string, preferredType?: string) => {
  if (!type || !preferredType) return false;

  const typeGroup = getAliasGroup(type);
  const preferredGroup = getAliasGroup(preferredType);

  return Array.from(typeGroup).some((entry) => preferredGroup.has(entry));
};

export const resolveTypePreference = (
  options: string[],
  preferredTypes: string[]
) => {
  for (const preferredType of preferredTypes) {
    const match = options.find((option) =>
      typeMatchesPreference(option, preferredType)
    );
    if (match) return match;
  }

  return "";
};

export const getDefaultTypes = (
  task?: string,
  dataset?: string
): DefaultTypePreferences => {
  const normalizedDataset = dataset?.toLowerCase();
  const sourcePreferences =
    normalizedDataset === "primekg" ? ["Drug", "Compound"] : ["Compound", "Drug"];

  if (task === "drug_repurposing") {
    return {
      source: sourcePreferences,
      target: ["Disease"],
    };
  }

  if (task === "drug_target") {
    // Per-dataset target types: Hetionet uses Gene; OREGANO's saved pairs are
    // keyed on Protein (many entities like "5-HT receptor 1E" exist as both
    // Protein and Gene, and picking the wrong type sends the lookup to a
    // non-existent pair ID and forces a fresh search); fall back to "Target"
    // as a generic last-resort for any other dataset.
    const target =
      normalizedDataset === "hetionet"
        ? ["Gene"]
        : normalizedDataset === "oregano"
          ? ["Protein"]
          : ["Target"];
    return {
      source: sourcePreferences,
      target,
    };
  }

  return {
    source: [],
    target: [],
  };
};
