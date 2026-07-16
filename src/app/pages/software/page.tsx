"use client";

import { useMemo } from "react";
import {
  Code,
  Database,
  Graph,
  BracketsCurly,
  RocketLaunch,
  Brain,
  GithubLogo,
  ArrowSquareOut,
} from "phosphor-react";
import type { Icon as PhosphorIcon } from "phosphor-react";
import Navbar from "../../components/general/Navbar";
import PageText from "../../components/general/PageText";
import { useTheme, useThemeContext } from "../../../../styles/ThemeContext";

interface TechCard {
  title: string;
  body: string;
  Icon: PhosphorIcon;
  tech: string[];
  link?: { url: string; label: string; license?: string };
  // Data-source attribution (name + license + link). When present, rendered in
  // place of the plain tech chips so each source carries its license and a link
  // to where it's published.
  sources?: { name: string; license: string; url: string }[];
  // Legacy theme preserves the OG student-built per-card accents. These are
  // the indices used in the original Software page and must not change.
  legacyAccentIdx: number;
}

export default function SoftwarePage() {
  const colors = useTheme();
  const { theme } = useThemeContext();

  // Shared teal accent for non-legacy themes, same family as About and the
  // homepage accordion so meta/context pages read as one visual group. Light
  // mode picks the darker saturated teal.
  const unifiedAccent =
    theme === "light" ? colors.headingAccents[11] : colors.headingAccents[9];

  // Per-card accent: legacy keeps its OG student-built per-card hues
  // (frozen-palette rule), all other themes collapse to the single teal so
  // the page stops looking like a rainbow bento.
  const accentFor = (card: TechCard): string =>
    theme === "legacy"
      ? colors.headingAccents[card.legacyAccentIdx]
      : unifiedAccent;

  // Per-dataset chip colors, Hetionet=purple, Oregano=blue, PrimeKG=green.
  // Mirrors the semantic palette used on the tagline / DatasetCard / persona
  // cards so the user recognizes each dataset at a glance. Legacy falls back
  // to the card's own accent to match the OG's per-card color language.
  const DATASET_CHIP_INDEX: Record<string, number> = {
    Hetionet: 0,
    Oregano: 3,
    PrimeKG: 6,
  };
  const chipColorFor = (tag: string, cardAccent: string): string => {
    if (theme === "legacy") return cardAccent;
    const idx = DATASET_CHIP_INDEX[tag];
    return idx != null ? colors.headingAccents[idx] : unifiedAccent;
  };

  const cards: TechCard[] = useMemo(
    () => [
      // Legacy accent indices match the OG student build (animatedColors cycles
      // through [3, 6, 9], blue / teal / green). In legacy the animatedColors
      // and headingAccents arrays are identical so the index works for both.
      {
        title: "Frontend Application",
        body: "A responsive expert workflow for persona selection, dataset/task setup, and step-by-step inspection of generated explanations.",
        Icon: Code,
        tech: ["Next.js", "React", "TypeScript"],
        legacyAccentIdx: 3,
      },
      {
        title: "Graph Visualization",
        body: "Reasoning paths rendered as interactive graphs, so users can inspect how drugs, targets, and diseases connect inside the knowledge graph.",
        Icon: Graph,
        tech: ["Cytoscape.js"],
        legacyAccentIdx: 6,
      },
      {
        title: "REx Reasoning Engine",
        body: "Path-based link prediction for Drug Repurposing and Drug–Target Interaction. Reinforcement learning discovers and ranks biologically meaningful reasoning paths.",
        Icon: Brain,
        tech: ["PyTorch", "Reinforcement Learning"],
        link: {
          url: "https://github.com/liseda-lab/REx_PyTorch/tree/main",
          label: "Repository",
          license: "Apache 2.0",
        },
        legacyAccentIdx: 9,
      },
      {
        title: "Datasets & Knowledge Graphs",
        body: "Biomedical knowledge graphs organized with train/validation/test splits, vocabularies, and human-readable labels, the relational backbone for every prediction.",
        Icon: Database,
        tech: [],
        sources: [
          { name: "Hetionet", license: "CC0 1.0", url: "https://het.io/" },
          {
            name: "PrimeKG",
            license: "MIT",
            url: "https://github.com/mims-harvard/PrimeKG",
          },
          {
            name: "Oregano",
            license: "CC BY 4.0",
            url: "https://doi.org/10.5281/zenodo.10103842",
          },
        ],
        legacyAccentIdx: 6,
      },
      {
        title: "Adaptive XAI",
        body: "Persona-shaped explanation scoring using local or API-based language models. Tunes explanation style for different expert needs without altering scientific signal.",
        Icon: BracketsCurly,
        tech: ["Qwen", "GPT", "LLM"],
        link: {
          url: "https://github.com/liseda-lab/Perspective_XAI/tree/main",
          label: "Repository",
          license: "Apache 2.0",
        },
        legacyAccentIdx: 9,
      },
      {
        title: "Execution & Reproducibility",
        body: "Run orchestration with configuration-driven dataset, task, and persona settings. Saved models and explanation JSONs keep experiments traceable across environments.",
        Icon: RocketLaunch,
        tech: ["UV", "Config scripts"],
        legacyAccentIdx: 3,
      },
    ],
    []
  );

  return (
    <>
      <style>{`
        .tech-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1rem;
          max-width: 1040px;
          margin: 0 auto;
        }
        .tech-card {
          padding: 1.1rem 1.25rem;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          transition: transform 0.18s ease, border-color 0.18s ease;
        }
        .tech-card:hover {
          transform: translateY(-2px);
        }
        .tech-card-header {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .tech-card-title {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          font-size: 0.98rem;
          font-weight: 700;
          margin: 0;
          line-height: 1.25;
        }
        .tech-card-body {
          margin: 0;
          font-size: 0.88rem;
          line-height: 1.55;
        }
        .tech-card-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin-top: auto;
          padding-top: 0.25rem;
        }
        .tech-chip {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 0.22rem 0.55rem;
          border-radius: 999px;
          border: 1px solid;
          line-height: 1.2;
          white-space: nowrap;
        }
        .tech-link {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-decoration: none;
          padding: 0.3rem 0.6rem;
          border-radius: 8px;
          border: 1px solid;
          white-space: nowrap;
          transition: background 0.15s ease;
        }
        .tech-link:hover {
          background: color-mix(in srgb, currentColor 14%, transparent);
        }
        .tech-sources {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-top: auto;
          padding-top: 0.25rem;
        }
        .tech-source {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.72rem;
          font-weight: 600;
          text-decoration: none;
          padding: 0.22rem 0.55rem;
          border-radius: 999px;
          border: 1px solid;
          line-height: 1.2;
          white-space: nowrap;
          transition: background 0.15s ease;
        }
        .tech-source:hover {
          background: color-mix(in srgb, currentColor 20%, transparent);
        }
        .tech-source-lic {
          font-weight: 500;
          opacity: 0.78;
        }
        .tech-link-lic {
          font-weight: 500;
          opacity: 0.78;
        }
      `}</style>

      <Navbar />
      <PageText title="">
        <h1 className="sr-only">Software Architecture</h1>

        <div
          style={{
            // Vertically center the grid in the remaining viewport (minus the
            // navbar + PageText's own top/bottom padding). Prevents the "cards
            // hugging the top, big empty space below" look now that the grid
            // fits comfortably in one screen.
            minHeight: "calc(100vh - 220px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
          }}
        >
          <div className="tech-grid">
          {cards.map((card) => {
            const Icon = card.Icon;
            const cardAccent = accentFor(card);
            return (
              <article
                key={card.title}
                className="tech-card"
                style={{
                  background: colors.card,
                  border: `1px solid ${cardAccent}55`,
                  borderLeft: `3px solid ${cardAccent}`,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                  color: colors.white,
                }}
              >
                <div className="tech-card-header">
                  <h2
                    className="tech-card-title"
                    style={{ color: cardAccent }}
                  >
                    <Icon size={18} weight="bold" aria-hidden="true" />
                    {card.title}
                  </h2>
                  {card.link && (
                    <a
                      href={card.link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tech-link"
                      style={{
                        color: cardAccent,
                        borderColor: `${cardAccent}60`,
                      }}
                    >
                      <GithubLogo size={13} weight="bold" aria-hidden="true" />
                      {card.link.label}
                      {card.link.license && (
                        <span className="tech-link-lic">
                          · {card.link.license}
                        </span>
                      )}
                      <ArrowSquareOut size={11} weight="bold" aria-hidden="true" />
                    </a>
                  )}
                </div>

                <p
                  className="tech-card-body"
                  style={{ color: `${colors.white}d0` }}
                >
                  {card.body}
                </p>

                {card.sources ? (
                  <div className="tech-sources">
                    {card.sources.map((s) => {
                      const chipColor = chipColorFor(s.name, cardAccent);
                      return (
                        <a
                          key={s.name}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tech-source"
                          style={{
                            color: chipColor,
                            borderColor: `${chipColor}60`,
                            background: `${chipColor}12`,
                          }}
                        >
                          {s.name}
                          <span className="tech-source-lic">· {s.license}</span>
                          <ArrowSquareOut size={10} weight="bold" aria-hidden="true" />
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="tech-card-tags">
                    {card.tech.map((tag) => {
                      const chipColor = chipColorFor(tag, cardAccent);
                      return (
                        <span
                          key={tag}
                          className="tech-chip"
                          style={{
                            color: chipColor,
                            borderColor: `${chipColor}60`,
                            background: `${chipColor}12`,
                          }}
                        >
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
          </div>

          <a
            href="https://github.com/liseda-lab/ADDEx"
            target="_blank"
            rel="noopener noreferrer"
            className="tech-link"
            style={{ color: unifiedAccent, borderColor: `${unifiedAccent}60` }}
          >
            <GithubLogo size={14} weight="bold" aria-hidden="true" />
            ADDEx repository
            <span className="tech-link-lic">· Apache 2.0</span>
            <ArrowSquareOut size={12} weight="bold" aria-hidden="true" />
          </a>
        </div>
      </PageText>
    </>
  );
}
