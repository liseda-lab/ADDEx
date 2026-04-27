"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuestions } from "./persona";
import Navbar from "@/app/components/general/Navbar";
import PageText from "@/app/components/general/PageText";
import Banner from "@/app/components/general/Banner";
import { User } from "phosphor-react";
import { useTheme, useThemeContext } from "../../../../styles/ThemeContext";

export default function ProfileSetupPage() {
  const colors = useTheme();
  const { theme } = useThemeContext();
  const questions = useQuestions();
  // Match the persona-card accents used on the manual-selection page (and the
  // side-menu profile symbol derives from this value). Legacy keeps the OG
  // colors.green / colors.firstColor; other themes use the vivid headingAccents
  // so the symbol pops in a consistent way across the whole flow.
  const PERSONA_METADATA = useMemo(
    () =>
      ({
        mechanistic_analyst: {
          name: "Mechanistic Analyst",
          accentColor:
            theme === "legacy" ? colors.green : colors.headingAccents[3],
          icon: "Gear",
        },
        insight_driven: {
          name: "Insight Driven",
          accentColor:
            theme === "legacy" ? colors.firstColor : colors.headingAccents[0],
          icon: "ShareNetwork",
        },
      } as const),
    [colors, theme]
  );
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  const router = useRouter();

  const handleSubmit = () => {
    const votes = {
      mechanistic_analyst: 0,
      insight_driven: 0,
    };

    for (const question of questions) {
      const selectedValue = answers[question.id];
      const selectedOption = question.options.find(
        (option) => option.value === selectedValue
      );

      if (selectedOption) {
        votes[selectedOption.personaId] += 1;
      }
    }

    const personaId =
      votes.mechanistic_analyst >= votes.insight_driven
        ? "mechanistic_analyst"
        : "insight_driven";
    const persona = PERSONA_METADATA[personaId];

    const params = new URLSearchParams({
      persona: personaId,
      personaName: persona.name,
      accentColor: persona.accentColor,
      icon: persona.icon,
    });

    router.push(`/pages/task?${params.toString()}`);
  };

  return (
    <>
      <Navbar />

      <PageText title={""}>
        <h1 className="sr-only">Explanation Mode Setup</h1>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
        <Banner
          title="Explanation Mode Setup"
          description="Answer the questions to set your explanation mode, or choose manually."
          buttonText="Choose manually"
          buttonHref="/pages/profile/manual"
          icon={User}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Questions, each rendered as a proper ARIA radiogroup so screen
            readers announce the group/label/selection state, and keyboard
            users can navigate options with Arrow keys (roving tabindex).
            Grid layout so questions fit side-by-side on wide screens and no
            longer require scrolling to reach the last one. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1rem",
            alignItems: "stretch",
          }}
        >
          {questions.map((q) => {
            const selectedIdx = q.options.findIndex(
              (o) => o.value === answers[q.id]
            );
            // Roving tabindex: only one radio per group is tabbable. Prefer
            // the currently-selected option; otherwise the first one.
            const activeIdx = selectedIdx >= 0 ? selectedIdx : 0;
            const labelId = `question-${q.id}-label`;

            const moveFocus = (nextIdx: number) => {
              const wrapped = (nextIdx + q.options.length) % q.options.length;
              const next = q.options[wrapped];
              setAnswers((prev) => ({ ...prev, [q.id]: next.value }));
              // Move DOM focus to the newly-selected radio so the focus ring
              // tracks the selection (standard radio-group behavior).
              const el = document.getElementById(
                `radio-${q.id}-${next.value}`
              );
              el?.focus();
            };

            return (
              <div
                key={q.id}
                style={{
                  padding: "1rem 1.15rem",
                  borderRadius: "14px",
                  background: colors.card,
                  border: `1px solid ${q.accentColor}60`,
                  borderLeft: `4px solid ${q.accentColor}`,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <h3
                  id={labelId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontWeight: 700,
                    fontSize: "0.98rem",
                    lineHeight: 1.3,
                    color: q.accentColor,
                    margin: "0 0 0.75rem 0",
                  }}
                >
                  {q.question}
                </h3>

                <div
                  role="radiogroup"
                  aria-labelledby={labelId}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.45rem",
                    flex: 1,
                  }}
                >
                  {q.options.map((opt, idx) => {
                    const isSelected = answers[q.id] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        id={`radio-${q.id}-${opt.value}`}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={idx === activeIdx ? 0 : -1}
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [q.id]: opt.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                            e.preventDefault();
                            moveFocus(idx + 1);
                          } else if (
                            e.key === "ArrowUp" ||
                            e.key === "ArrowLeft"
                          ) {
                            e.preventDefault();
                            moveFocus(idx - 1);
                          } else if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            setAnswers((prev) => ({
                              ...prev,
                              [q.id]: opt.value,
                            }));
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.65rem",
                          padding: "0.7rem 0.85rem",
                          borderRadius: "10px",
                          cursor: "pointer",
                          border: isSelected
                            ? `1px solid ${q.accentColor}`
                            : `1px solid ${colors.grayDark}`,
                          background: isSelected
                            ? `${q.accentColor}22`
                            : `${colors.white}08`,
                          color: colors.white,
                          boxShadow: isSelected
                            ? `0 0 0 1px ${q.accentColor}55, 0 4px 18px ${q.accentColor}22`
                            : "none",
                          transition: "all 0.18s ease",
                          textAlign: "left",
                          fontSize: "0.88rem",
                          lineHeight: 1.4,
                          flex: 1,
                        }}
                      >
                        <div
                          aria-hidden="true"
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            border: `2px solid ${
                              isSelected ? q.accentColor : colors.grayDark
                            }`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {isSelected && (
                            <div
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                background: q.accentColor,
                              }}
                            />
                          )}
                        </div>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.6rem",
            marginTop: "2rem",
          }}
        >
          <button
            disabled={!allAnswered}
            onClick={handleSubmit}
            style={{
              width: "180px",
              padding: "0.85rem",
              borderRadius: "10px",
              border: "none",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: allAnswered ? "pointer" : "not-allowed",
              background: colors.buttons,
              color: "#FFFFFF",
              opacity: allAnswered ? 1 : 0.45,
              transition: "opacity 0.15s ease, transform 0.15s ease",
              display: "block",
              textAlign: "center",
            }}
            onMouseEnter={(e) => {
              if (allAnswered) e.currentTarget.style.opacity = "0.88";
            }}
            onMouseLeave={(e) => {
              if (allAnswered) e.currentTarget.style.opacity = "1";
            }}
          >
            Submit
          </button>
        </div>
        </div>
        </div>
      </PageText>
    </>
  );
}
