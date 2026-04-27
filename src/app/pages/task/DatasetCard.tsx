"use client";

import { useMemo, useState } from "react";
import { Plus, Minus } from "phosphor-react";
import { useTheme, useThemeContext } from "../../../../styles/ThemeContext";
import { useRouter, useSearchParams } from "next/navigation";

interface DatasetCardProps {
  dataset: {
    name: string;
    tasks: string[];
    description?: string;
  };
  index: number;
}

export default function DatasetCard({ dataset, index }: DatasetCardProps) {
  const colors = useTheme();
  const { theme } = useThemeContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState(false);

  const persona = searchParams.get("persona");

  const TASK_LABELS: Record<string, string> = {
    drug_target: "Drug-Target Interaction",
    drug_repurposing: "Drug Repurposing",
  };
  const format = (t: string) =>
    TASK_LABELS[t] ??
    t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  // Curated copy matching the Guide page so the dataset selector and the
  // Guide read the same facts. The API's `dataset.description` comes from the
  // .txt files bundled with each graph and predates the Guide rewrite; we
  // override it here with the more specific scale + characterization.
  const DATASET_META: Record<string, { scale: string; description: string }> = {
    hetionet: {
      scale: "≈45k entities · 4.5M triples",
      description:
        "Broad integration of 29 biomedical resources. Wide coverage for drug repurposing across compounds, diseases, genes, anatomy, and side effects.",
    },
    primekg: {
      scale: "≈130k entities · 8.1M triples",
      description:
        "Molecular-to-clinical scale with the deepest biological detail. Strong for hypotheses that need fine-grained pathway or clinical-evidence reasoning.",
    },
    oregano: {
      scale: "≈98k entities · 1.6M triples",
      description:
        "Natural-product pharmacology specialization. Covers compounds, targets, activities, and effects with a pharmacological emphasis.",
    },
  };
  const meta = DATASET_META[dataset.name.toLowerCase()];
  const displayDescription = meta?.description ?? dataset.description;

  // Semantic per-dataset accent: Hetionet=purple, Oregano=blue, PrimeKG=green.
  // Matches the tagline / persona / Software page color language.
  const DATASET_ACCENT_INDEX: Record<string, number> = {
    hetionet: 0,
    oregano: 3,
    primekg: 6,
  };
  const legacyCardColors = useMemo(
    () => [colors.firstColor, colors.thirdColor, colors.fourthColor],
    [colors]
  );
  const accent =
    theme === "legacy"
      ? legacyCardColors[index % legacyCardColors.length]
      : colors.headingAccents[
          DATASET_ACCENT_INDEX[dataset.name.toLowerCase()] ?? 6
        ];

  const handleClick = (task: string) => {
    if (!persona) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("persona", persona);
    params.set("dataset", dataset.name);
    params.set("task", task);

    router.push(`/pages/search?${params.toString()}`);
  };

  const descriptionId = `dataset-desc-${dataset.name.toLowerCase()}`;

  return (
    <article
      style={{
        borderRadius: 12,
        background: colors.card,
        border: `1px solid ${accent}60`,
        borderLeft: `3px solid ${accent}`,
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        padding: "1rem 1.2rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.55rem",
        // Don't stretch to match a sibling card's height, when one card
        // expands its "+" description, the others should stay their own size
        // instead of growing to the row's tallest card.
        alignSelf: "start",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <h3
          style={{
            margin: 0,
            color: accent,
            fontSize: "1rem",
            fontWeight: 700,
            lineHeight: 1.3,
            textTransform: "capitalize",
          }}
        >
          {dataset.name}
        </h3>

        {displayDescription && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={descriptionId}
            aria-label={expanded ? "Hide description" : "Show description"}
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              border: `1px solid ${accent}60`,
              background: `${accent}12`,
              color: accent,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s ease",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "color-mix(in srgb, currentColor 14%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${accent}12`;
            }}
          >
            {expanded ? (
              <Minus size={14} weight="bold" aria-hidden="true" />
            ) : (
              <Plus size={14} weight="bold" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Scale line, always visible when known, mirrors the Guide. */}
      {meta && (
        <p
          style={{
            margin: 0,
            color: `${colors.white}a8`,
            fontSize: "0.78rem",
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {meta.scale}
        </p>
      )}

      {expanded && displayDescription && (
        <p
          id={descriptionId}
          style={{
            margin: 0,
            color: `${colors.white}d0`,
            fontSize: "0.88rem",
            lineHeight: 1.55,
          }}
        >
          {displayDescription}
        </p>
      )}

      <div
        style={{
          marginTop: "auto",
          paddingTop: "0.2rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.4rem",
        }}
      >
        {dataset.tasks.map((task) => (
          <button
            key={task}
            onClick={() => handleClick(task)}
            disabled={!persona}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: 999,
              border: `1px solid ${accent}60`,
              background: `${accent}12`,
              color: accent,
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: persona ? "pointer" : "not-allowed",
              opacity: persona ? 1 : 0.5,
              transition: "background 0.15s ease",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (persona)
                e.currentTarget.style.background =
                  "color-mix(in srgb, currentColor 14%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${accent}12`;
            }}
          >
            {format(task)}
          </button>
        ))}
      </div>
    </article>
  );
}
