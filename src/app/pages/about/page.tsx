"use client";

import { useEffect, useRef, useState } from "react";
import { LinkSimple, GithubLogo, Quotes, X, Check, Copy, BookBookmark, Hourglass } from "phosphor-react";
import Navbar from "../../components/general/Navbar";
import PageText from "../../components/general/PageText";
import { useTheme, useThemeContext } from "../../../../styles/ThemeContext";

type Paper = {
  title: string;
  authors: string;
  abstract: string;
  paperUrl: string;
  repoUrl: string;
  bibtex: string;
  apa: string;
};

const papers: Paper[] = [
  {
    title: "Rewarding Explainability in Drug Repurposing with Knowledge Graphs",
    authors: "Susana Nunes, Samy Badreddine, Catia Pesquita",
    abstract:
      "REx is a method for generating scientifically meaningful explanations in knowledge graphs, particularly for drug repurposing. It uses reinforcement learning guided by properties of good scientific explanations to identify explanatory paths, which are enriched with biomedical ontologies. Evaluations on benchmark datasets show that REx both improves predictive performance and produces explanations aligned with established scientific knowledge, outperforming existing methods.",
    paperUrl: "https://doi.org/10.24963/ijcai.2025/515",
    repoUrl: "https://github.com/liseda-lab/REx/tree/main",
    bibtex: `@inproceedings{nunesRewarding2025,
  title     = {Rewarding Explainability in Drug Repurposing with Knowledge Graphs},
  author    = {Nunes, Susana and Badreddine, Samy and Pesquita, Catia},
  booktitle = {Proceedings of the Thirty-Fourth International Joint Conference on
               Artificial Intelligence, {IJCAI-25}},
  publisher = {International Joint Conferences on Artificial Intelligence Organization},
  editor    = {James Kwok},
  pages     = {4624--4632},
  year      = {2025},
  month     = {8},
  note      = {Main Track},
  doi       = {10.24963/ijcai.2025/515},
  url       = {https://doi.org/10.24963/ijcai.2025/515},
}`,
    apa: "Nunes, S., Badreddine, S., & Pesquita, C. (2025). Rewarding Explainability in Drug Repurposing with Knowledge Graphs. In J. Kwok (Ed.), Proceedings of the Thirty-Fourth International Joint Conference on Artificial Intelligence, IJCAI-25 (pp. 4624–4632). International Joint Conferences on Artificial Intelligence Organization. https://doi.org/10.24963/ijcai.2025/515",
  },
  {
    title:
      "Agentic Personas for Adaptive Scientific Explanations with Knowledge Graphs",
    authors: "Susana Nunes, Tiago Guerreiro, Catia Pesquita",
    abstract:
      "This work uses reinforcement learning with agentic personas (structured models of expert reasoning styles) to generate scientific explanations in knowledge graph-based drug discovery. The method tailors explanations to distinct expert perspectives while maintaining strong predictive performance, and is consistently preferred over non-adaptive baselines. It also reduces the need for human feedback, making adaptive explainability more scalable.",
    paperUrl: "https://arxiv.org/abs/2603.21846",
    repoUrl: "https://github.com/liseda-lab/Perspective_XAI/tree/main",
    bibtex: `@article{nunes2026agentic,
  title={Agentic Personas for Adaptive Scientific Explanations with Knowledge Graphs},
  author={Nunes, Susana and Guerreiro, Tiago and Pesquita, Catia},
  journal={arXiv preprint arXiv:2603.21846},
  year={2026}
}`,
    apa: "Nunes, S., Guerreiro, T., & Pesquita, C. (2026). Agentic Personas for Adaptive Scientific Explanations with Knowledge Graphs. arXiv preprint arXiv:2603.21846.",
  },
];

type CiteFormat = "bibtex" | "apa";

interface CitationModalProps {
  paper: Paper;
  accent: string;
  onClose: () => void;
}

function CitationModal({ paper, accent, onClose }: CitationModalProps) {
  const colors = useTheme();
  const [format, setFormat] = useState<CiteFormat>("bibtex");
  const [copied, setCopied] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Prevent background scroll while modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const text = format === "bibtex" ? paper.bibtex : paper.apa;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked, fall back silently
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="citation-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          maxHeight: "85vh",
          overflow: "hidden",
          background: colors.card,
          border: `1px solid ${accent}60`,
          borderRadius: 14,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "1rem",
            padding: "1.1rem 1.25rem",
            borderBottom: `1px solid ${colors.grayDark}55`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                color: `${colors.white}99`,
                fontSize: "0.72rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              Cite this work
            </p>
            <h2
              id="citation-modal-title"
              style={{
                margin: "0.25rem 0 0 0",
                color: colors.white,
                fontSize: "1rem",
                fontWeight: 700,
                lineHeight: 1.35,
              }}
            >
              {paper.title}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close citation dialog"
            style={{
              background: "transparent",
              border: `1px solid ${colors.grayDark}`,
              borderRadius: 8,
              color: colors.white,
              cursor: "pointer",
              padding: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 32,
              minHeight: 32,
            }}
          >
            <X size={16} weight="bold" aria-hidden="true" />
          </button>
        </div>

        {/* Format tabs */}
        <div
          role="tablist"
          aria-label="Citation format"
          style={{
            display: "flex",
            gap: 4,
            padding: "0.75rem 1.25rem 0 1.25rem",
          }}
        >
          {(
            [
              { id: "bibtex", label: "BibTeX" },
              { id: "apa", label: "APA" },
            ] as const
          ).map((t) => {
            const active = format === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFormat(t.id)}
                style={{
                  padding: "0.45rem 0.95rem",
                  borderRadius: 8,
                  border: active
                    ? `1px solid ${accent}`
                    : `1px solid ${colors.grayDark}55`,
                  background: active ? `${accent}22` : "transparent",
                  color: active ? accent : `${colors.white}cc`,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Citation body */}
        <div
          style={{
            padding: "1rem 1.25rem",
            flex: 1,
            minHeight: 0,
            overflow: "auto",
          }}
        >
          <pre
            style={{
              margin: 0,
              padding: "0.9rem 1rem",
              borderRadius: 10,
              background: `${colors.white}08`,
              border: `1px solid ${colors.grayDark}55`,
              color: colors.white,
              fontFamily:
                "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "0.82rem",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {text}
          </pre>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
            padding: "0.85rem 1.25rem",
            borderTop: `1px solid ${colors.grayDark}55`,
          }}
        >
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Copy ${format === "bibtex" ? "BibTeX" : "APA"} citation to clipboard`}
            style={{
              padding: "0.55rem 1rem",
              borderRadius: 8,
              border: "none",
              background: copied ? colors.green : colors.buttons,
              color: "#FFFFFF",
              fontSize: "0.88rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              transition: "background 0.2s ease",
              minHeight: 36,
            }}
          >
            {copied ? (
              <>
                <Check size={16} weight="bold" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy size={16} weight="bold" aria-hidden="true" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AboutPage() {
  const colors = useTheme();
  const { theme } = useThemeContext();
  // One accent color across the whole About page, the "research context" hue,
  // shared with the homepage accordion so the two pages read as the same
  // visual family. Doesn't collide with the three semantic colors (purple for
  // Hetionet/Insight Driven/explore, blue for PrimeKG/Mechanistic Analyst/
  // evaluate, green for Oregano/Neutral/trust). Light mode uses
  // `headingAccents[10]` (moderate teal), vivid [9] is too punchy on white;
  // muted `colors.teal` was too pale. Must match the `outlineAccent` in
  // [page.tsx] so the two pages stay visually in sync. Legacy theme keeps its
  // OG multi-accent layout per the frozen-legacy rule.
  const unifiedAccent =
    theme === "light"
      ? colors.headingAccents[11]
      : colors.headingAccents[9];
  const accents =
    theme === "legacy"
      ? [colors.headingAccents[3], colors.headingAccents[6]]
      : [unifiedAccent, unifiedAccent];
  const platformAccent = unifiedAccent;
  const [citing, setCiting] = useState<{ paper: Paper; accent: string } | null>(
    null
  );

  return (
    <>
      <Navbar />
      <PageText title="">
        <h1 className="sr-only">About the Research</h1>

        {/* Platform citation card, prominent, at the top */}
        <section
          aria-labelledby="cite-addex-heading"
          style={{
            borderRadius: "14px",
            background: colors.card,
            border: `1px solid ${platformAccent}80`,
            borderLeft: `4px solid ${platformAccent}`,
            boxShadow: `0 6px 24px rgba(0,0,0,0.32), 0 0 0 1px ${platformAccent}20 inset`,
            padding: "1.1rem 1.4rem",
            marginBottom: "1.1rem",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h2
            id="cite-addex-heading"
            style={{
              margin: "0 0 0.3rem 0",
              color: platformAccent,
              fontSize: "1.15rem",
              lineHeight: 1.3,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <BookBookmark size={18} weight="bold" aria-hidden="true" />
            ADDEx
          </h2>

          <p
            style={{
              margin: "0 0 0.7rem 0",
              color: colors.white,
              fontSize: "0.95rem",
              lineHeight: 1.55,
            }}
          >
            If you use ADDEx in your research, please cite the following
            paper:
          </p>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              padding: "0.35rem 0.7rem",
              borderRadius: 8,
              background: `${platformAccent}18`,
              border: `1px dashed ${platformAccent}88`,
              color: colors.white,
              fontSize: "0.82rem",
              alignSelf: "flex-start",
            }}
          >
            <Hourglass size={14} weight="bold" color={platformAccent} aria-hidden="true" />
            Citation details coming soon.
          </div>

          <a
            href="https://github.com/liseda-lab/ADDEx"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginTop: "0.7rem",
              alignSelf: "flex-start",
              textDecoration: "none",
              padding: "0.42rem 0.85rem",
              borderRadius: "8px",
              background: "transparent",
              color: platformAccent,
              fontWeight: 600,
              fontSize: "0.82rem",
              border: `1px solid ${platformAccent}60`,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              minHeight: 32,
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "color-mix(in srgb, currentColor 14%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <GithubLogo size={14} weight="bold" aria-hidden="true" />
            Repository
          </a>
        </section>

        {/* Section heading for the two algorithm papers */}
        <h2
          style={{
            margin: "0.2rem 0 0.7rem 0",
            color: colors.white,
            fontSize: "1rem",
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          Research behind ADDEx
        </h2>

        <div
          style={{
            display: "grid",
            gap: "1.1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
            alignItems: "stretch",
          }}
        >
          {papers.map((paper, idx) => {
            const accent = accents[idx % accents.length];
            return (
              <article
                key={paper.title}
                style={{
                  borderRadius: "14px",
                  background: colors.card,
                  border: `1px solid ${accent}60`,
                  borderLeft: `3px solid ${accent}`,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  padding: "1.1rem 1.3rem",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 0.35rem 0",
                    color: accent,
                    fontSize: "1.05rem",
                    lineHeight: 1.3,
                    fontWeight: 700,
                  }}
                >
                  {paper.title}
                </h3>

                <p
                  style={{
                    margin: "0 0 0.65rem 0",
                    color: `${colors.white}b5`,
                    fontWeight: 500,
                    fontSize: "0.82rem",
                    lineHeight: 1.4,
                    fontStyle: "italic",
                  }}
                >
                  {paper.authors}
                </p>

                <p
                  style={{
                    margin: "0 0 0.9rem 0",
                    color: colors.white,
                    fontSize: "0.92rem",
                    lineHeight: 1.6,
                    textAlign: "justify",
                  }}
                >
                  {paper.abstract}
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: "0.55rem",
                    flexWrap: "wrap",
                    marginTop: "auto",
                  }}
                >
                  <a
                    href={paper.paperUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      textDecoration: "none",
                      padding: "0.42rem 0.85rem",
                      borderRadius: "8px",
                      background: colors.buttons,
                      color: "#FFFFFF",
                      fontWeight: 600,
                      fontSize: "0.82rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      minHeight: 32,
                      transition: "opacity 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.88";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                  >
                    <LinkSimple size={16} weight="bold" aria-hidden="true" />
                    Open Paper
                  </a>

                  <a
                    href={paper.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      textDecoration: "none",
                      padding: "0.42rem 0.85rem",
                      borderRadius: "8px",
                      background: "transparent",
                      color: accent,
                      fontWeight: 600,
                      fontSize: "0.82rem",
                      border: `1px solid ${accent}60`,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      minHeight: 32,
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "color-mix(in srgb, currentColor 14%, transparent)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <GithubLogo size={14} weight="bold" aria-hidden="true" />
                    Repository
                  </a>

                  <button
                    type="button"
                    onClick={() => setCiting({ paper, accent })}
                    style={{
                      padding: "0.42rem 0.85rem",
                      borderRadius: "8px",
                      background: "transparent",
                      color: accent,
                      fontWeight: 600,
                      fontSize: "0.82rem",
                      border: `1px solid ${accent}`,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      minHeight: 32,
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "color-mix(in srgb, currentColor 14%, transparent)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Quotes size={14} weight="bold" aria-hidden="true" />
                    Cite
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </PageText>

      {citing && (
        <CitationModal
          paper={citing.paper}
          accent={citing.accent}
          onClose={() => setCiting(null)}
        />
      )}
    </>
  );
}
