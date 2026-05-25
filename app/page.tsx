"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Pill,
  ArrowFatLinesRight,
  Lightbulb,
  ShareNetwork,
  Graph,
  UserSwitch,
  Flask,
  ArrowRight,
  Book,
  Compass,
  CaretDown,
} from "phosphor-react";
import type { Icon as PhosphorIcon } from "phosphor-react";
import Navbar from "./components/general/Navbar";
import AnimatedBackground from "./components/general/AnimatedBg";
import { useThemeContext } from "../../styles/ThemeContext";

interface HomeSection {
  key: string;
  title: string;
  body: string;
  Icon: PhosphorIcon;
}

export default function HomePage() {
  const { palette: colors, theme } = useThemeContext();
  // Single-expansion accordion: open one row at a time so the page reads like
  // a book chapter outline rather than a wall of parallel paragraphs.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const toggleCard = (key: string) =>
    setExpandedKey((prev) => (prev === key ? null : key));
  // Legacy theme has a white page background AND uses colors.white = "#FFFFFF"
  // as its primary fill, so hero text (which sits on the page bg, not inside a
  // card) would render white-on-white. Fall back to the theme's foreground
  // value there so the OG white-backdrop look stays readable.
  const isLegacy = theme === "legacy";
  const heroText = isLegacy ? "#171717" : colors.white;

  // Homepage outline / accordion accent: teal, same hue family used on the
  // About page so the two pages visually connect as "meta / research context."
  // Light mode uses `headingAccents[10]` (moderate teal), the vivid [9] is
  // too punchy on white, but `colors.teal` was too pale. Legacy keeps its OG
  // sage per the frozen-legacy rule.
  const outlineAccent = isLegacy
    ? colors.firstColor
    : theme === "light"
      ? colors.headingAccents[11]
      : colors.headingAccents[9];

  const sections: HomeSection[] = useMemo(
    () => [
      {
        key: "what",
        title: "What is ADDEx?",
        body: "ADDEx (Adaptive Drug Development Explanations) is an expert-centered system for explainable drug development. It brings together three components: an adaptive explainability engine that generates KG-based reasoning paths, a verbalization module that turns those paths into natural language, and an interactive visualization where domain experts can explore and assess the resulting hypotheses.",
        Icon: Pill,
      },
      {
        key: "how",
        title: "How ADDEx Works?",
        body: "ADDEx treats Drug Repurposing and Drug-Target Interaction as link prediction over biomedical knowledge graphs. It generates each hypothesis together with a reasoning path — a chain of meaningful relationships connecting the source and target — then enriches the path with ontological context, verbalizes it, and presents it interactively for the expert.",
        Icon: Graph,
      },
      {
        key: "rex",
        title: "What is the REx Framework?",
        body: "REx (and its persona-conditioned extension Adaptive REx) is the reasoning engine underlying ADDEx. A reinforcement learning agent traverses the knowledge graph to discover paths that both reach the target entity (fidelity) and pass through biologically informative nodes (relevance, measured via information content over entity clusters).",
        Icon: ArrowFatLinesRight,
      },
      {
        key: "modes",
        title: "Explanation Modes",
        body: "ADDEx adapts its explanations to different expert reasoning styles through agentic personas. The Mechanistic Analyst prefers detailed, multi-step explanations with rich biological context; the Insight-Driven Synthesist favors concise paths centered on a single pivotal connection. The Neutral Evaluator is the baseline mode — no persona — useful when you want unbiased exploration.",
        Icon: UserSwitch,
      },
      {
        key: "xai",
        title: "Explainable AI",
        body: "Explainability in ADDEx is intrinsic — the reasoning paths are part of how each prediction is produced, not a post-hoc rationalization. Unlike feature-attribution methods such as LIME or SHAP, this preserves the relational and chained structure that biomedical reasoning depends on.",
        Icon: Lightbulb,
      },
      {
        key: "kg",
        title: "Knowledge Graphs",
        body: "A knowledge graph encodes biological entities (compounds, diseases, genes, proteins) and the known relationships between them. ADDEx integrates three established biomedical KGs — Hetionet, PrimeKG, and OREGANO — and uses them as both the substrate for prediction and the source material for explanation.",
        Icon: ShareNetwork,
      },
      {
        key: "why",
        title: "Why ADDEx Matters",
        body: "Drug development typically spans 10–15 years and $1–2 billion per approved drug, with over 90% of candidates failing in clinical trials. ADDEx tackles this by closing the loop between AI-generated hypotheses, mechanistic explanation, and expert evaluation in a single interactive workflow — making computational predictions transparent enough to act on.",
        Icon: Flask,
      },
    ],
    []
  );

  return (
    <>
      <Navbar />

      <style>{`
        @keyframes halo-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 0.85; transform: scale(1.08); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scroll-bounce {
          0%, 100% { transform: translate(-50%, 0); opacity: 0.55; }
          50%      { transform: translate(-50%, 8px); opacity: 0.95; }
        }

        .home-scroll-hint {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.78rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-decoration: none;
          cursor: pointer;
          animation: scroll-bounce 2.2s ease-in-out infinite;
          transition: opacity 0.2s ease;
        }
        .home-scroll-hint:hover { opacity: 1 !important; }
        .home-scroll-hint:focus-visible {
          opacity: 1 !important;
          outline: none;
          border-radius: 6px;
          box-shadow:
            0 0 0 3px var(--home-focus-ring, currentColor),
            0 0 0 5px rgba(0, 0, 0, 0.2);
        }

        .home-hero-mark {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .home-hero-mark .halo {
          position: absolute;
          inset: -40px;
          border-radius: 50%;
          filter: blur(40px);
          animation: halo-pulse 5s ease-in-out infinite;
          pointer-events: none;
        }
        .home-hero-title {
          font-size: clamp(3.25rem, 9.5vw, 6.75rem);
          font-weight: 800;
          letter-spacing: -0.05em;
          line-height: 1;
          margin: 1.25rem 0 0.6rem;
        }
        .home-hero-title .hero-x {
          font-style: italic;
          display: inline-block;
          margin-left: -0.12em;
        }
        .home-hero-tagline {
          font-size: clamp(1rem, 1.6vw, 1.2rem);
          max-width: 640px;
          margin: 0 auto 2rem;
          line-height: 1.55;
          opacity: 0.82;
        }

        .home-cta-row {
          display: flex;
          gap: 0.85rem;
          justify-content: center;
          flex-wrap: wrap;
        }
        .home-cta {
          padding: 0.9rem 1.75rem;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.95rem;
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          text-decoration: none;
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.2s ease;
          white-space: nowrap;
        }
        .home-cta-primary { border: 1px solid rgba(255,255,255,0.12); }
        .home-cta-primary:hover { transform: translateY(-2px); }
        .home-cta-secondary { background: transparent; }
        .home-cta-secondary:hover { transform: translateY(-2px); }
        /* Keyboard-only focus: strong, unmistakable halo so Tab users always
           know where Enter will land. --home-focus-ring is set inline from
           the theme accent so the ring stays theme-aware. */
        .home-cta:focus-visible {
          outline: none;
          transform: translateY(-2px);
          box-shadow:
            0 0 0 4px var(--home-focus-ring),
            0 0 0 7px rgba(0, 0, 0, 0.25),
            0 10px 28px rgba(0, 0, 0, 0.35);
        }

        .home-outline {
          display: flex;
          flex-direction: column;
          max-width: 880px;
          margin: 0 auto;
          background: var(--outline-bg);
          border: 1px solid var(--outline-divider);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        }
        .home-outline-row {
          border-top: 1px solid var(--outline-divider);
          animation: fade-up 0.5s ease backwards;
        }
        .home-outline-row:first-child {
          border-top: none;
        }
        .home-outline-row[data-expanded="true"] {
          border-left: 2px solid var(--outline-accent);
        }
        .home-outline-btn {
          all: unset;
          display: flex;
          align-items: center;
          gap: 0.85rem;
          width: 100%;
          padding: 1rem 1.25rem;
          cursor: pointer;
          box-sizing: border-box;
        }
        .home-outline-btn:hover .home-outline-title {
          color: var(--outline-accent);
        }
        .home-outline-btn:focus-visible {
          outline: 2px solid var(--outline-accent);
          outline-offset: -2px;
        }
        .home-outline-icon {
          flex-shrink: 0;
          opacity: 0.7;
        }
        .home-outline-title {
          flex: 1;
          font-weight: 600;
          font-size: 1rem;
          line-height: 1.3;
          margin: 0;
          transition: color 0.15s ease;
        }
        .home-outline-chevron {
          flex-shrink: 0;
          transition: transform 0.2s ease;
          opacity: 0.6;
        }
        .home-outline-row[data-expanded="true"] .home-outline-chevron {
          transform: rotate(180deg);
          opacity: 1;
        }
        .home-outline-row[data-expanded="true"] .home-outline-title {
          color: var(--outline-accent);
        }
        .home-outline-body {
          padding: 0 1.25rem 1.5rem 3.1rem;
          margin: 0;
          line-height: 1.7;
          font-size: 0.95rem;
          animation: fade-up 0.25s ease;
        }
        @media (max-width: 600px) {
          .home-outline-body {
            padding-left: 1.25rem;
            font-size: 0.92rem;
          }
        }
      `}</style>

      <main
        id="main-content"
        style={{
          minHeight: "100vh",
          paddingTop: 80,
          paddingBottom: 64,
          paddingLeft: "1.5rem",
          paddingRight: "1.5rem",
          background: colors.background,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <AnimatedBackground />

        {/* Hero, takes the full first viewport so the animated dots breathe */}
        <section
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 1100,
            margin: "0 auto",
            textAlign: "center",
            minHeight: "calc(100vh - 80px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "1rem 0",
          }}
        >
          <div className="home-hero-mark">
            <span
              className="halo"
              style={{
                background: `radial-gradient(circle, ${colors.headingAccents[3]}88 0%, ${colors.headingAccents[6]}44 40%, transparent 70%)`,
              }}
            />
            <Image
              src="/images/pill_logo.PNG"
              alt="ADDEx"
              width={150}
              height={150}
              priority
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                position: "relative",
                objectFit: "contain",
                userSelect: "none",
                WebkitUserDrag: "none",
                pointerEvents: "none",
              } as React.CSSProperties}
            />
          </div>

          <h1 className="home-hero-title" style={{ color: heroText }}>
            ADD<span>E<span className="hero-x">x</span></span>
          </h1>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.9rem",
              margin: "0 0 1.75rem",
            }}
          >
            <p
              style={{
                fontSize: "clamp(0.82rem, 1.15vw, 0.98rem)",
                fontWeight: 600,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                margin: 0,
                opacity: 0.82,
                color: heroText,
              }}
            >
              Adaptive Drug Development Explanations
            </p>
          </div>

          <p className="home-hero-tagline" style={{ color: heroText }}>
            Expert-centered explainable AI for drug development.
            <br />
            Hypotheses you can{" "}
            <span style={{ color: colors.headingAccents[0], fontWeight: 600 }}>
              explore
            </span>
            ,{" "}
            <span style={{ color: colors.headingAccents[3], fontWeight: 600 }}>
              evaluate
            </span>
            , and{" "}
            <span style={{ color: colors.headingAccents[6], fontWeight: 600 }}>
              trust
            </span>
            .
          </p>

          <div className="home-cta-row">
            <Link
              href="/pages/profile"
              className="home-cta home-cta-primary"
              style={{
                background: colors.buttons,
                color: "#FFFFFF",
                boxShadow: `0 10px 30px ${colors.buttons}55`,
                ["--home-focus-ring" as string]: colors.headingAccents[6],
              } as React.CSSProperties}
            >
              Start Exploring
              <ArrowRight size={18} weight="bold" aria-hidden="true" />
            </Link>
            <Link
              href="/pages/guide"
              className="home-cta home-cta-secondary"
              style={{
                color: heroText,
                border: `1px solid ${heroText}55`,
                ["--home-focus-ring" as string]: colors.firstColor,
              } as React.CSSProperties}
            >
              <Compass size={18} weight="bold" color={heroText} aria-hidden="true" />
              Guide
            </Link>
            <Link
              href="/pages/about"
              className="home-cta home-cta-secondary"
              style={{
                color: heroText,
                border: `1px solid ${heroText}55`,
                ["--home-focus-ring" as string]: colors.firstColor,
              } as React.CSSProperties}
            >
              <Book size={18} weight="bold" color={heroText} aria-hidden="true" />
              Our Research
            </Link>
          </div>

          <a
            href="#home-bento"
            className="home-scroll-hint"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("home-bento")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            style={{
              color: `${heroText}AA`,
              ["--home-focus-ring" as string]: colors.headingAccents[3],
            } as React.CSSProperties}
          >
            <span>Learn more</span>
            <CaretDown size={18} weight="bold" aria-hidden="true" />
          </a>
        </section>

        <section
          id="home-bento"
          aria-labelledby="home-bento-heading"
          style={{
            position: "relative",
            zIndex: 1,
            scrollMarginTop: 80,
            paddingTop: "1.5rem",
          }}
        >
          <h2 id="home-bento-heading" className="sr-only">
            About ADDEx
          </h2>
          <div
            className="home-outline"
            style={
              {
                ["--outline-accent" as string]: outlineAccent,
                // Divider color keys off `colors.white` (card-appropriate
                // foreground) so it reads against the card background in every
                // theme, not `heroText` which targets the page background and
                // renders near-black in legacy (dark navy card → invisible).
                ["--outline-divider" as string]: `${colors.white}20`,
                ["--outline-bg" as string]: colors.card,
              } as React.CSSProperties
            }
          >
            {sections.map((s, i) => {
              const isExpanded = expandedKey === s.key;
              const bodyId = `outline-body-${s.key}`;
              return (
                <div
                  key={s.key}
                  className="home-outline-row"
                  data-expanded={isExpanded}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <button
                    type="button"
                    className="home-outline-btn"
                    onClick={() => toggleCard(s.key)}
                    aria-expanded={isExpanded}
                    aria-controls={bodyId}
                  >
                    <s.Icon
                      size={20}
                      weight="regular"
                      aria-hidden="true"
                      className="home-outline-icon"
                      color={colors.white}
                    />
                    <h3
                      className="home-outline-title"
                      style={{ color: colors.white }}
                    >
                      {s.title}
                    </h3>
                    <CaretDown
                      size={16}
                      weight="bold"
                      aria-hidden="true"
                      className="home-outline-chevron"
                      color={colors.white}
                    />
                  </button>
                  {isExpanded && (
                    <p
                      id={bodyId}
                      className="home-outline-body"
                      style={{ color: `${colors.white}cc` }}
                    >
                      {s.body}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
