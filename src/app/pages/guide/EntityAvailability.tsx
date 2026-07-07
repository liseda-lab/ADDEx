"use client";

import { useEffect, useState } from "react";
import { MagnifyingGlass } from "phosphor-react";
import { useTheme } from "../../../../styles/ThemeContext";

interface GraphAvail {
  dataset: string;
  tasks: string[];
  types: string[];
  // The entity's name in this dataset when it was reached via the gene/protein
  // crossover (Hetionet symbol <-> OREGANO protein name).
  viaName?: string;
}
interface Result {
  name: string;
  graphs: GraphAvail[];
}

const DATASET_LABEL: Record<string, string> = {
  hetionet: "Hetionet",
  oregano: "OREGANO",
  primekg: "PrimeKG",
};
const TASK_LABEL: Record<string, string> = {
  drug_repurposing: "Repurposing",
  drug_target: "Target",
};
// Same per-dataset accent language as the dataset selector (Hetionet=purple,
// Oregano=blue, PrimeKG=green).
const DATASET_ACCENT_INDEX: Record<string, number> = {
  hetionet: 0,
  oregano: 3,
  primekg: 6,
};
const DATASET_ORDER = ["hetionet", "primekg", "oregano"];

export default function EntityAvailability({
  bare = false,
}: {
  // When true, drop the outer card chrome (used inside the modal launcher,
  // which already provides a container).
  bare?: boolean;
}) {
  const colors = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/entity-availability?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((j: { results?: Result[] }) => {
          setResults(j.results ?? []);
          setLoading(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setResults([]);
            setLoading(false);
          }
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const accentFor = (dataset: string) =>
    colors.headingAccents[DATASET_ACCENT_INDEX[dataset.toLowerCase()] ?? 6];
  const orderIdx = (d: string) => {
    const i = DATASET_ORDER.indexOf(d.toLowerCase());
    return i === -1 ? 99 : i;
  };

  const trimmed = query.trim();
  const showHint = trimmed.length < 2;
  const showEmpty = trimmed.length >= 2 && !loading && results.length === 0;

  return (
    <div
      style={{
        borderRadius: bare ? 0 : 14,
        background: bare ? "transparent" : colors.card,
        border: bare ? "none" : `1px solid ${colors.white}22`,
        padding: bare ? 0 : "1.1rem 1.2rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
      }}
    >
      <div style={{ position: "relative" }}>
        <MagnifyingGlass
          size={16}
          weight="bold"
          color={`${colors.white}80`}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a drug, disease, gene, or protein name…"
          aria-label="Search for an entity to see which datasets contain it"
          style={{
            width: "100%",
            padding: "0.6rem 0.75rem 0.6rem 2.1rem",
            borderRadius: 10,
            border: `1px solid ${colors.white}25`,
            background: `${colors.white}0d`,
            color: colors.white,
            fontSize: "0.9rem",
            outline: "none",
          }}
        />
      </div>

      {showHint && (
        <p
          style={{
            margin: 0,
            color: `${colors.white}90`,
            fontSize: "0.85rem",
            lineHeight: 1.55,
          }}
        >
          Type at least two letters to see which datasets contain a drug,
          disease, gene, or protein, and under which tasks.
        </p>
      )}

      {loading && (
        <p style={{ margin: 0, color: `${colors.white}80`, fontSize: "0.85rem" }}>
          Searching…
        </p>
      )}

      {showEmpty && (
        <p style={{ margin: 0, color: `${colors.white}80`, fontSize: "0.85rem" }}>
          No entity matches “{trimmed}”. Check spelling, or try its common name
          (gene symbols and protein names differ between datasets).
        </p>
      )}

      {results.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.7rem",
            maxHeight: 340,
            overflowY: "auto",
          }}
        >
          {results.map((r) => (
            <li
              key={r.name}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                paddingBottom: "0.65rem",
                borderBottom: `1px solid ${colors.white}12`,
              }}
            >
              <span
                style={{
                  color: colors.white,
                  fontSize: "0.9rem",
                  fontWeight: 600,
                }}
              >
                {r.name}
              </span>
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}
              >
                {[...r.graphs]
                  .sort((a, b) => orderIdx(a.dataset) - orderIdx(b.dataset))
                  .map((g) => {
                    const accent = accentFor(g.dataset);
                    const tasks = g.tasks
                      .map((t) => TASK_LABEL[t] ?? t)
                      .join(", ");
                    const types = g.types.join(" / ");
                    return (
                      <span
                        key={g.dataset}
                        style={{
                          display: "inline-flex",
                          alignItems: "baseline",
                          gap: 5,
                          borderRadius: 8,
                          border: `1px solid ${accent}55`,
                          background: `${accent}14`,
                          color: accent,
                          padding: "3px 9px",
                          fontSize: "0.76rem",
                          fontWeight: 600,
                          lineHeight: 1.35,
                        }}
                      >
                        {DATASET_LABEL[g.dataset.toLowerCase()] ?? g.dataset}
                        <span style={{ opacity: 0.75, fontWeight: 500 }}>
                          {types ? `· ${types}` : ""}
                          {tasks ? ` · ${tasks}` : ""}
                        </span>
                      </span>
                    );
                  })}
              </div>
              {[...r.graphs]
                .filter((g) => g.viaName)
                .map((g) => (
                  <span
                    key={`via-${g.dataset}`}
                    style={{
                      fontSize: "0.74rem",
                      color: `${colors.white}80`,
                      lineHeight: 1.4,
                    }}
                  >
                    ↔ In {DATASET_LABEL[g.dataset.toLowerCase()] ?? g.dataset} as
                    “{g.viaName}”
                  </span>
                ))}
            </li>
          ))}
        </ul>
      )}

      <p
        style={{
          margin: 0,
          color: `${colors.white}70`,
          fontSize: "0.78rem",
          lineHeight: 1.5,
        }}
      >
        “Available” means the entity exists as a node in that dataset — not that
        a given pair will have a path. Use the “Only pre-computed hypotheses”
        switch on the search page to see which pairs are ready.
      </p>
    </div>
  );
}
