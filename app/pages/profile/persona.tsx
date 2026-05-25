"use client";
import React, { useMemo } from "react";
import { useTheme, useThemeContext } from "../../../../styles/ThemeContext";

export interface Persona {
  id: string;
  name: string;
  tagline: string;
  profile: string;
  alsoValues: string;
  accentColor: string;
  icon: React.ReactNode;
}

export interface PersonaOption {
  value: string;
  label: string;
  personaId: "mechanistic_analyst" | "insight_driven";
}

export interface PersonaQuestion {
  id: number;
  question: string;
  accentColor: string;
  options: PersonaOption[];
}

export function useQuestions(): PersonaQuestion[] {
  const colors = useTheme();
  const { theme } = useThemeContext();
  // Legacy keeps its OG jewel-tone per-question accents (blue/green/teal) per
  // the frozen-palette rule. In all other themes the three questions share a
  // single teal accent, same "meta/setup" hue used on About and the homepage
  // accordion. Keeping each question a different color collided with the
  // semantic palette (purple=Insight Driven, green=Neutral, teal=About).
  const unifiedAccent =
    theme === "light" ? colors.headingAccents[11] : colors.headingAccents[9];
  const q1 = theme === "legacy" ? colors.firstColor : unifiedAccent;
  const q2 = theme === "legacy" ? colors.thirdColor : unifiedAccent;
  const q3 = theme === "legacy" ? colors.fourthColor : unifiedAccent;
  return useMemo(
    () => [
      {
        id: 1,
        question: "How detailed should the explanation be?",
        accentColor: q1,
        options: [
          {
            value: "detailed",
            label: "A detailed step-by-step explanation.",
            personaId: "mechanistic_analyst",
          },
          {
            value: "streamlined",
            label: "A streamlined explanation with fewer steps.",
            personaId: "insight_driven",
          },
        ],
      },
      {
        id: 2,
        question: "Do you want high-level concepts?",
        accentColor: q2,
        options: [
          {
            value: "no-concepts",
            label: "I do not need high-level concepts, I am happy with seeing only a detailed explanation.",
            personaId: "mechanistic_analyst",
          },
          {
            value: "concepts",
            label: "I prefer to see high-level concepts that frame why things belong together.",
            personaId: "insight_driven",
          },
        ],
      },
      {
        id: 3,
        question: "How specific should relations be?",
        accentColor: q3,
        options: [
          {
            value: "specific",
            label: 'Explanations should be based on specific relations such as "inhibits" or "binds".',
            personaId: "mechanistic_analyst",
          },
          {
            value: "broad",
            label: 'Explanations can also include less specific relations such as "treats" or "causes".',
            personaId: "insight_driven",
          },
        ],
      },
    ],
    [q1, q2, q3]
  );
}
