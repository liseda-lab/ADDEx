"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTheme, useThemeContext } from "../../../../styles/ThemeContext";

// Curated example pairs drawn from the ADDEx paper case studies. Each one is
// known to have paths, so clicking → Search yields a result. Labels match the
// graph_labels.tsv entries exactly (verified). Dataset colors follow the
// semantic palette (purple/blue/green for Hetionet/Oregano/PrimeKG).
export interface ExamplePair {
  dataset: "hetionet" | "oregano" | "primekg";
  task: "drug_repurposing" | "drug_target";
  taskLabel: string;
  sourceType: string;
  sourceName: string;
  targetType: string;
  targetName: string;
}

// The three cross-dataset paper examples, shown on the landing/Quick Search
// state and on the dataset+task page (where no dataset is chosen yet).
export const EXAMPLE_PAIRS: ExamplePair[] = [
  {
    dataset: "hetionet",
    task: "drug_repurposing",
    taskLabel: "Drug Repurposing",
    sourceType: "Compound",
    sourceName: "Budesonide",
    targetType: "Disease",
    targetName: "Asthma",
  },
  {
    dataset: "hetionet",
    task: "drug_target",
    taskLabel: "Drug-Target Interaction",
    sourceType: "Compound",
    sourceName: "Apomorphine",
    targetType: "Gene",
    targetName: "Drd2",
  },
  {
    dataset: "oregano",
    task: "drug_target",
    taskLabel: "Drug-Target Interaction",
    sourceType: "Compound",
    sourceName: "Apomorphine",
    targetType: "Protein",
    targetName: "Dopamine D4 receptor",
  },
];

const capitalizeFirst = (name: string) =>
  name.length === 0 ? name : name.charAt(0).toUpperCase() + name.slice(1);

interface Props {
  examples: ExamplePair[];
  // Small uppercase label above the grid. Pass null to render the cards alone.
  heading?: string | null;
  // Tighter padding, smaller type and a softer accent. Used where the cards are
  // a secondary offer (the dataset+task page) rather than the main call to
  // action (the search empty state).
  compact?: boolean;
}

// Grid of clickable example pairs. Shared by the search page (empty state) and
// the dataset+task page, so both render an identical card and build the same
// autorun link.
export default function ExamplePairCards({
  examples,
  heading = "Try an example",
  compact = false,
}: Props) {
  const colors = useTheme();
  const { theme } = useThemeContext();
  const searchParams = useSearchParams();

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {heading ? (
        <div
          style={{
            fontSize: "0.78rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: `${colors.white}88`,
            textAlign: "left",
          }}
        >
          {heading}
        </div>
      ) : null}
      <div
        style={{
          display: "grid",
          // 3 equal columns on any reasonable width; wrap to single column only
          // when the viewport is narrow (≤640px). Fixed columns avoid the
          // "Oregano drops to a new row" behavior that happened when auto-fit
          // was near its breakpoint.
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: compact ? "0.5rem" : "0.75rem",
        }}
      >
        {examples.map((ex) => {
          const accentIdx =
            ex.dataset === "hetionet" ? 0 : ex.dataset === "oregano" ? 3 : 6;
          const datasetAccent =
            theme === "legacy"
              ? colors.firstColor
              : colors.headingAccents[accentIdx];
          const isSelected =
            searchParams.get("dataset") === ex.dataset &&
            searchParams.get("task") === ex.task &&
            searchParams.get("sourceName") === ex.sourceName &&
            searchParams.get("targetName") === ex.targetName;
          // Respect the user's current persona if they've already picked one
          // (via wizard or previous visit). Fall back to Neutral only when the
          // user arrived without selecting a persona.
          const personaId = searchParams.get("persona") ?? "neutral_evaluator";
          const personaName =
            searchParams.get("personaName") ??
            (personaId === "mechanistic_analyst"
              ? "Mechanistic Analyst"
              : personaId === "insight_driven"
                ? "Insight Driven"
                : "Neutral");
          const personaIcon =
            searchParams.get("icon") ??
            (personaId === "mechanistic_analyst"
              ? "Gear"
              : personaId === "insight_driven"
                ? "ShareNetwork"
                : "Lightbulb");
          // `autorun=1` tells the search page to fire the explanation search
          // automatically once the pair resolves, so clicking an example loads
          // it directly without a second click on the run button. Consumed (and
          // stripped) once in PairSideMenu's auto-run effect.
          const href = `/pages/search?persona=${personaId}&personaName=${encodeURIComponent(personaName)}&icon=${personaIcon}&dataset=${ex.dataset}&task=${ex.task}&sourceType=${encodeURIComponent(ex.sourceType)}&sourceName=${encodeURIComponent(ex.sourceName)}&targetType=${encodeURIComponent(ex.targetType)}&targetName=${encodeURIComponent(ex.targetName)}&autorun=1`;
          return (
            <Link
              key={`${ex.dataset}-${ex.task}-${ex.sourceName}-${ex.targetName}`}
              href={href}
              aria-current={isSelected ? "true" : undefined}
              style={{
                textAlign: "left",
                textDecoration: "none",
                padding: compact ? "0.55rem 0.7rem" : "0.85rem 1rem",
                borderRadius: compact ? 8 : 10,
                background: isSelected ? `${datasetAccent}33` : colors.card,
                border: `1px solid ${datasetAccent}${
                  isSelected ? "" : compact ? "33" : "55"
                }`,
                borderLeft: `${
                  isSelected ? (compact ? "3px" : "5px") : compact ? "2px" : "3px"
                } solid ${datasetAccent}`,
                color: colors.white,
                display: "flex",
                flexDirection: "column",
                gap: compact ? "0.15rem" : "0.3rem",
                transition:
                  "transform 0.15s ease, border-color 0.15s ease, background 0.15s ease",
                boxShadow: isSelected
                  ? `0 6px 18px ${datasetAccent}40`
                  : undefined,
                transform: isSelected ? "translateY(-2px)" : undefined,
                opacity: isSelected ? 1 : compact ? 0.75 : 0.85,
              }}
              onMouseEnter={(e) => {
                if (isSelected) return;
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.borderColor = `${datasetAccent}AA`;
                e.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                if (isSelected) return;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = `${datasetAccent}${
                  compact ? "33" : "55"
                }`;
                e.currentTarget.style.opacity = compact ? "0.75" : "0.85";
              }}
            >
              <div
                style={{
                  fontSize: compact ? "0.63rem" : "0.72rem",
                  fontWeight: 600,
                  color: datasetAccent,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  opacity: compact ? 0.85 : 1,
                }}
              >
                {ex.dataset} · {ex.taskLabel}
              </div>
              <div
                style={{
                  fontSize: compact ? "0.82rem" : "0.95rem",
                  fontWeight: 600,
                  lineHeight: 1.3,
                }}
              >
                {capitalizeFirst(ex.sourceName)} →{" "}
                {capitalizeFirst(ex.targetName)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
