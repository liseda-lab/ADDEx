"use client";

import { useState } from "react";
import {
  Compass,
  UserFocus,
  Database,
  Target,
  Brain,
  Eye,
  Info,
  Question,
  ArrowRight,
  Graph,
  ChatCircleText,
  LinkSimple,
  DownloadSimple,
  FlowArrow,
} from "phosphor-react";
import type { Icon as PhosphorIcon } from "phosphor-react";
import Navbar from "../../components/general/Navbar";
import PageText from "../../components/general/PageText";
import { useTheme, useThemeContext } from "../../../../styles/ThemeContext";

interface SchemaStep {
  label: string;
  caption: string;
  Icon: PhosphorIcon;
}

interface FaqItem {
  q: string;
  a: string;
}

export default function GuidePage() {
  const colors = useTheme();
  const { theme } = useThemeContext();
  // Accordion state for the FAQ: at most one entry open at a time.
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Section-neutral accent for headings and generic cards, matches About /
  // Software so meta pages read as one visual group. Legacy keeps its OG
  // multi-accent layout (frozen palette).
  const unifiedAccent =
    theme === "light" ? colors.headingAccents[11] : colors.headingAccents[9];

  // Legacy uses a white page background but `colors.white = "#FFFFFF"` as the
  // primary text fill, so text that sits on the page background (not inside a
  // card) renders white-on-white. Fall back to the theme's foreground value
  // for those nodes; card-internal text keeps using `colors.white` since
  // legacy cards are dark navy.
  const isLegacy = theme === "legacy";
  const pageText = isLegacy ? "#171717" : colors.white;

  const schemaSteps: SchemaStep[] = [
    {
      label: "Explanation Mode",
      caption: "Choose how you want explanations shaped.",
      Icon: UserFocus,
    },
    {
      label: "Dataset",
      caption: "Pick a knowledge graph and a task.",
      Icon: Database,
    },
    {
      label: "Hypothesis",
      caption: "Enter a source and a target.",
      Icon: Target,
    },
    {
      label: "Reasoning",
      caption: "ADDEx walks the graph and ranks paths.",
      Icon: Brain,
    },
    {
      label: "Read",
      caption: "Inspect the graph, summary, and other resources.",
      Icon: Eye,
    },
  ];

  const readingItems: { Icon: PhosphorIcon; title: string; body: string }[] = [
    {
      Icon: FlowArrow,
      title: "Reasoning paths",
      body: "Each path is an ordered chain of entities connected by labeled relations. Paths are scored and ranked; the top-ranked path renders by default. Use the path list to toggle others on.",
    },
    {
      Icon: Graph,
      title: "Ontology (LCA) nodes",
      body: "Lighter nodes added during enrichment. They aren't in the knowledge graph itself; they come from CHEBI, NCIT, or Gene Ontology, and mark the lowest common class shared by adjacent path entities.",
    },
    {
      Icon: Info,
      title: "Node colors and the legend",
      body: "Each color encodes an entity type (Compound, Gene, Disease, Pathway, …). The legend on the visualizer lists the types in the current view. Click a swatch to open a color picker and recolor any type to your preference.",
    },
    {
      Icon: LinkSimple,
      title: "External references",
      body: "In the Path Selection panel, entity names are live links to an authoritative record for that entity, for example DrugBank for compounds or NCBI Gene for genes. The exact source depends on the entity type and the selected knowledge graph.",
    },
    {
      Icon: ChatCircleText,
      title: "Verbal summary",
      body: "A small language model (Qwen 3, 4B) turns the ranked paths into a short natural-language description that preserves the path structure, giving you a narrative view alongside the graph.",
    },
    {
      Icon: DownloadSimple,
      title: "Export",
      body: "Export the current graph as PNG, JPEG, SVG, or PDF, with or without the verbal summary panel, for inclusion in reports, slides, or expert discussions.",
    },
  ];

  const faqItems: FaqItem[] = [
    {
      q: "Why do explanation modes matter?",
      a: "Different experts read evidence differently: a mechanistic analyst wants detailed step-by-step chains, a synthesist wants the single pivotal link, and a neutral evaluator wants an unconditioned ranking. The persona doesn't change which paths exist in the graph; it changes how they're scored and ranked, so the same hypothesis surfaces different evidence depending on the mode you pick.",
    },
    {
      q: "My search returned no paths. What should I do?",
      a: "Not every source–target hypothesis has a valid path in the selected graph. Try a different target, switch to another knowledge graph that covers the hypothesis, or use one of the example hypotheses from the search page to sanity-check your setup.",
    },
    {
      q: "How long does a search take?",
      a: "It depends on the knowledge graph and the hypothesis. On a consumer laptop (Apple M1, MPS backend), path generation — the time before the interactive graph appears — averages ~20s on OREGANO, ~30s on Hetionet, and ~50s on PrimeKG. The verbalization runs in parallel afterwards and populates the side panel without blocking exploration; it usually takes another ~70s, longer for hypotheses with many paths. Already-cached hypotheses return instantly.",
    },
    {
      q: "Can I change the explanation mode mid-session?",
      a: "Yes. The left panel on the Search page has a persona selector, so you can switch modes on the fly without returning to the setup. That's also why Quick Search skips the setup step: you can configure persona, dataset, task, and hypothesis directly from the search panel.",
    },
    {
      q: "Can I retrain on my own knowledge graph?",
      a: "The REx reasoning engine is released as a standalone PyTorch library under Apache 2.0, so you can train it on your own graph and use the output however you like. Plugging the resulting model into ADDEx itself is only possible if you self-host the ADDEx repo; the hosted version runs with the bundled graphs. For additions or bug reports on the hosted version, open an issue on GitHub.",
    },
    {
      q: "How do I cite this work?",
      a: "The Research page lists the ADDEx reference and the two underlying algorithm papers (REx and Adaptive REx), with BibTeX and APA snippets ready to copy.",
    },
  ];

  const sectionHeading = (
    id: string,
    label: string,
    Icon: PhosphorIcon,
    hint?: string
  ) => (
    <div
      id={id}
      // Offset scroll target so the section heading isn't hidden behind the
      // fixed Navbar when reached via a jump-link.
      style={{ margin: "2.25rem 0 0.9rem 0", scrollMarginTop: "80px" }}
    >
      <h2
        style={{
          margin: 0,
          color: pageText,
          fontSize: "1.15rem",
          fontWeight: 700,
          letterSpacing: "-0.01em",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.55rem",
        }}
      >
        <Icon size={18} weight="bold" color={unifiedAccent} aria-hidden="true" />
        {label}
      </h2>
      {hint && (
        <p
          style={{
            margin: "0.3rem 0 0 0",
            color: `${pageText}b0`,
            fontSize: "0.9rem",
            lineHeight: 1.55,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );

  return (
    <>
      <Navbar />
      <PageText title="">
        <h1 className="sr-only">Guide</h1>

        <section
          aria-labelledby="guide-intro-heading"
          style={{
            marginBottom: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.7rem",
          }}
        >
          <h2
            id="guide-intro-heading"
            style={{
              margin: 0,
              color: pageText,
              fontSize: "1.25rem",
              fontWeight: 700,
              lineHeight: 1.3,
              letterSpacing: "-0.01em",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.55rem",
            }}
          >
            <Compass
              size={18}
              weight="bold"
              color={unifiedAccent}
              aria-hidden="true"
            />
            ADDEx Guide
          </h2>

          <p
            style={{
              margin: 0,
              color: `${pageText}d0`,
              fontSize: "0.95rem",
              lineHeight: 1.6,
            }}
          >
            The end-to-end workflow, the conventions used in the visualizer,
            and answers to the questions you&apos;re most likely to have.
          </p>

          <nav
            aria-label="Guide sections"
            style={{
              marginTop: "0.1rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.4rem",
            }}
          >
            {[
              { id: "how-it-works", label: "How it works" },
              { id: "reading", label: "Reading the results" },
              { id: "faq", label: "FAQ" },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0.3rem 0.7rem",
                  borderRadius: 999,
                  border: `1px solid ${unifiedAccent}60`,
                  background: "transparent",
                  color: unifiedAccent,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  transition: "background 0.15s ease",
                  lineHeight: 1.3,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "color-mix(in srgb, currentColor 14%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </section>

        {sectionHeading("how-it-works", "How it works", FlowArrow)}
        <div
          style={{
            borderRadius: 14,
            background: colors.card,
            border: `1px solid ${unifiedAccent}40`,
            padding: "1.4rem 1.2rem",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.4rem 0.8rem",
          }}
        >
          {schemaSteps.map(({ label, caption, Icon }, idx) => (
            <div
              key={label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.7rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.5rem",
                  width: 150,
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 14,
                    background: `${unifiedAccent}20`,
                    border: `1px solid ${unifiedAccent}60`,
                    color: unifiedAccent,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={26} weight="bold" aria-hidden="true" />
                </div>
                <div
                  style={{
                    color: colors.white,
                    fontSize: "0.92rem",
                    fontWeight: 700,
                    lineHeight: 1.2,
                    textAlign: "center",
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    color: `${colors.white}c0`,
                    fontSize: "0.78rem",
                    lineHeight: 1.45,
                    textAlign: "center",
                  }}
                >
                  {caption}
                </div>
              </div>
              {idx < schemaSteps.length - 1 && (
                <ArrowRight
                  size={18}
                  weight="bold"
                  color={`${unifiedAccent}aa`}
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>

        {sectionHeading(
          "reading",
          "Reading the results",
          Eye,
          "A quick reference for the conventions used in the visualizer and the verbal summary."
        )}
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          {readingItems.map(({ Icon, title, body }) => (
            <div
              key={title}
              style={{
                borderRadius: 10,
                background: colors.card,
                border: `1px solid ${unifiedAccent}40`,
                padding: "0.85rem 1rem",
                display: "flex",
                gap: "0.7rem",
                alignItems: "flex-start",
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: `${unifiedAccent}1c`,
                  border: `1px solid ${unifiedAccent}55`,
                  color: unifiedAccent,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={15} weight="bold" aria-hidden="true" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                  style={{
                    margin: "0 0 0.2rem 0",
                    color: colors.white,
                    fontSize: "0.92rem",
                    fontWeight: 700,
                    lineHeight: 1.3,
                  }}
                >
                  {title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: `${colors.white}d0`,
                    fontSize: "0.86rem",
                    lineHeight: 1.55,
                  }}
                >
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {sectionHeading("faq", "FAQ", Question)}
        <div style={{ display: "grid", gap: "0.7rem" }}>
          {faqItems.map(({ q, a }, i) => {
            const isOpen = openFaq === i;
            return (
              <details
                key={q}
                open={isOpen}
                // Prevent the native toggle so we can enforce "only one open
                // at a time". Summary's onClick drives state instead.
                onToggle={(e) => {
                  const next = (e.currentTarget as HTMLDetailsElement).open;
                  if (next !== isOpen) {
                    (e.currentTarget as HTMLDetailsElement).open = isOpen;
                  }
                }}
                style={{
                  borderRadius: 10,
                  background: colors.card,
                  border: `1px solid ${unifiedAccent}40`,
                  padding: "0.7rem 1rem",
                }}
              >
                <summary
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenFaq(isOpen ? null : i);
                  }}
                  style={{
                    cursor: "pointer",
                    color: colors.white,
                    fontSize: "0.92rem",
                    fontWeight: 600,
                    lineHeight: 1.4,
                    listStyle: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      color: unifiedAccent,
                      fontSize: "0.8rem",
                      fontWeight: 700,
                    }}
                  >
                    ?
                  </span>
                  {q}
                </summary>
                <p
                  style={{
                    margin: "0.5rem 0 0 0",
                    color: `${colors.white}d0`,
                    fontSize: "0.88rem",
                    lineHeight: 1.6,
                  }}
                >
                  {a}
                </p>
              </details>
            );
          })}
        </div>

      </PageText>
    </>
  );
}
