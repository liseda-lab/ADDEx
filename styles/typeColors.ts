// Per-theme node-type color palettes for the explanation visualizer.
// Lookup is keyed by theme name; entries are then normalized in useColors via
// `normalizeNodeType`, so case/underscore/space variants resolve to the same
// canonical key.
//
// This file used to be `typeColors.json`, but Turbopack's HMR pattern matcher
// occasionally chokes on hot-reloaded JSON imports
// ("Expected module to match pattern: …/typeColors.json (json)"), so we keep
// the data in TS to sidestep that.
import type { ThemeName } from "./themes";

export type TypeColorMap = Record<string, string>;

export const nodeColors: Record<ThemeName, TypeColorMap> = {
  legacy: {
    LCA: "#999999",
    Activity: "#F6B8B8",
    Anatomy: "#8ECDF2",
    ATC: "#E8B7D4",
    "Biological process": "#BFE3A8",
    "Cellular Component": "#7FD8E0",
    Compound: "#F5CFA0",
    Disease: "#57C9C5",
    Drug: "#F4B49E",
    Effect: "#CDB4F6",
    "Effect/Phenotype": "#F0AFC4",
    Entity: "#E6D1A3",
    Exposure: "#F7C8A0",
    Gene: "#AEB8FF",
    "Gene/Protein": "#8FA8F0",
    Indication: "#F4D35E",
    "Molecular function": "#F2E394",
    Molecule: "#FFC4A3",
    Pathway: "#8FE0B8",
    "Pharmacologic Class": "#CFE09B",
    Phenotype: "#F2A7E0",
    Protein: "#9FB7F5",
    "Side Effect": "#F29AC2",
    Side_effect: "#D98AE8",
    Symptom: "#FFB38A",
  },
  light: {
    LCA: "#D0D0D0",
    Activity: "#F2D8B8",
    Anatomy: "#F5D5B0",
    ATC: "#BFE0C5",
    "Biological process": "#BFE0C5",
    "Cellular Component": "#B0D6E8",
    Compound: "#A8D9B8",
    Disease: "#C8B8D8",
    Drug: "#A8D9B8",                     // green, alias of Compound
    Effect: "#DCC8E8",
    "Effect/Phenotype": "#F0B5C0",
    Entity: "#E8D8B5",
    Exposure: "#A0CADC",
    Gene: "#F0E2A0",                     // light yellow
    "Gene/Protein": "#F0E2A0",           // alias of Gene
    Indication: "#C5B8E0",
    "Molecular function": "#F5CC9F",
    Molecule: "#F5D5B0",
    Pathway: "#F0B8B8",
    "Pharmacologic Class": "#A0CADC",    // light blue per figure, distinct shade from CC
    Phenotype: "#F0B5C0",
    Protein: "#E8D580",                  // mid gold — yellow family, distinct from Gene
    "Side Effect": "#F2CAD2",
    Side_effect: "#F2CAD2",              // match Side Effect
    Symptom: "#F2C8C8",
    Target: "#D4B870",                   // darker gold/tan, distinct from Gene + Protein
  },
  dark: {
    LCA: "#D0D0D0",
    Activity: "#FCEAD0",
    Anatomy: "#FCE8CB",
    ATC: "#D8F0E0",
    "Biological process": "#D8F0E0",
    "Cellular Component": "#D0EAF5",
    Compound: "#CCEDD8",
    Disease: "#E8D5F0",
    Drug: "#CCEDD8",                     // green, alias of Compound
    Effect: "#F0E2FA",
    "Effect/Phenotype": "#FBD2DA",
    Entity: "#F8EBD0",
    Exposure: "#C8E5F2",
    Gene: "#FCF0BB",                     // light yellow
    "Gene/Protein": "#FCF0BB",           // alias of Gene
    Indication: "#E8D5F0",
    "Molecular function": "#FCE5C0",
    Molecule: "#FCE8CB",
    Pathway: "#FBD0D0",
    "Pharmacologic Class": "#C8E5F2",    // light blue per figure, distinct shade from CC
    Phenotype: "#FBD2DA",
    Protein: "#F5E090",                  // mid gold, distinct from Gene
    "Side Effect": "#FFE0E8",
    Side_effect: "#FFE0E8",              // match Side Effect
    Symptom: "#FCDDDD",
    Target: "#DCC070",                   // darker gold/tan, distinct from Gene + Protein
  },
  // Color-blind-safe palette built on Okabe–Ito hues, audited against the
  // three integrated KGs so every type that can co-occur in a single graph
  // (Hetionet, OREGANO, PrimeKG) gets a distinguishable color. With ~24
  // types and only 7 Okabe–Ito hues, the strategy is:
  //
  //  1. Assign each hue family a "primary" type (Compound→bluish green,
  //     Gene→yellow, Disease→reddish purple, Pathway→vermillion,
  //     CellularComponent→sky blue, Side Effect→orange,
  //     Pharmacologic Class→saturated blue).
  //  2. Use *lightness shades* within a family for additional types that
  //     co-occur with the primary. Lightness is the dimension CVD users
  //     retain, so dark/mid/light variants of the same hue stay
  //     distinguishable even when the hue itself collapses.
  //  3. Where a hue is genuinely needed by multiple co-occurring types in
  //     the same KG, place those types in *different* Okabe–Ito families.
  //  4. Aliases (Drug≡Compound, Effect/Phenotype≡Phenotype, etc.) and types
  //     restricted to a single KG (Target→OREGANO only, Symptom→Hetionet
  //     only, Exposure→PrimeKG only) are allowed to share colors with
  //     primaries from other KGs since they never share a graph.
  //
  // Per-KG distinguishability has been verified for Hetionet (11 types),
  // OREGANO (11 types), and PrimeKG (10 types) — every co-occurring pair
  // differs in either hue or lightness within Okabe–Ito.
  colorBlind: {
    LCA: "#B5B5B5",
    // Bluish-green family: Compound (mid) / Biological process (dark) /
    // ATC (light). All three can co-occur with Compound, lightness keeps
    // them apart.
    Compound: "#66BFA5",
    Drug: "#66BFA5",                 // alias of Compound
    "Biological process": "#007F5C",
    ATC: "#A5D9C0",
    // Yellow/gold family: Gene (light) / Protein (mid gold) / Target (dark
    // gold). Three distinct lightness steps so they stay distinguishable
    // for CVD users when any of them co-occur. Anatomy moves to the
    // reddish-purple family below to free a yellow tone for Protein.
    Gene: "#F0E442",
    "Gene/Protein": "#F0E442",           // alias of Gene
    Entity: "#F0E442",
    Protein: "#D4B400",                  // mid gold/mustard, yellow family
    Target: "#B58D00",                   // dark gold
    // Reddish-purple family: Disease (mid) / Effect (dark) / Anatomy (light)
    // / Indication-overflow. Disease anchors the family; Effect appears
    // alongside Disease in OREGANO so it gets the dark shade. Anatomy uses
    // light so it stays distinct from Disease in Hetionet/PrimeKG.
    Disease: "#CC79A7",
    Effect: "#8E4F73",
    Anatomy: "#E5B0CD",
    // Vermillion family: Pathway (full) / Symptom (light). Symptom is
    // Hetionet-only; the lightness gap keeps it from clashing with Pathway.
    Pathway: "#D55E00",
    Molecule: "#D55E00",             // alias of Pathway
    Symptom: "#ECB099",
    // Orange family: Side Effect (full) / Molecular function + Activity
    // (dark) / Phenotype + Effect/Phenotype (light). MF and Activity never
    // co-occur (Hetionet/PrimeKG vs OREGANO), so they share a shade.
    "Side Effect": "#E69F00",
    Side_effect: "#E69F00",
    "Molecular function": "#B27500",
    Activity: "#B27500",
    Phenotype: "#F2C26B",
    "Effect/Phenotype": "#F2C26B",
    // Sky-blue family: Cellular Component (full only — Exposure moves to
    // saturated blue to avoid collision in PrimeKG where both appear).
    "Cellular Component": "#56B4E9",
    // Saturated-blue family: Pharmacologic Class (Hetionet) / Exposure
    // (PrimeKG, never co-occurs with PharmClass) / Indication (OREGANO,
    // mid-blue lightness). Protein moved to the yellow family above.
    "Pharmacologic Class": "#0072B2",
    Exposure: "#0072B2",
    Indication: "#5AA1CB",
  },
  highContrast: {
    LCA: "#888888",
    Activity: "#FFB050",
    Anatomy: "#FFA060",
    ATC: "#80E090",
    "Biological process": "#80E090",
    "Cellular Component": "#50C0F8",
    Compound: "#50DC78",
    Disease: "#B070E8",
    Drug: "#50DC78",                     // green, alias of Compound
    Effect: "#C088FF",
    "Effect/Phenotype": "#FF7090",
    Entity: "#E0B040",
    Exposure: "#4090E0",
    Gene: "#FFE040",                     // saturated yellow
    "Gene/Protein": "#FFE040",           // alias of Gene
    Indication: "#A080E8",
    "Molecular function": "#FF9050",
    Molecule: "#FFA060",
    Pathway: "#FF6868",
    "Pharmacologic Class": "#4090E0",    // saturated blue per figure
    Phenotype: "#FF7090",
    Protein: "#E0C040",                  // gold, distinct from Gene
    "Side Effect": "#FF5080",
    Side_effect: "#FF5080",              // match Side Effect
    Symptom: "#FF7878",
    Target: "#B58D00",                   // dark gold/brown, distinct from Gene + Protein
  },
};
