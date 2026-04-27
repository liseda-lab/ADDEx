"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { User, ShareNetwork, Gear, Lightbulb } from "phosphor-react";
import PersonaCard from "../../profile/PersonaCard";
import { useTheme, useThemeContext } from "../../../../../styles/ThemeContext";
import CardsPage from "@/app/components/general/CardsPage";

const iconList = [ShareNetwork, Gear, Lightbulb];
// Parallel array, `IconComponent.displayName` is unreliable across
// phosphor-react versions, so we use explicit names that match the keys
// in PairSideMenu's `iconMap` for correct round-tripping through the URL.
const iconNames = ["ShareNetwork", "Gear", "Lightbulb"];

export default function PersonaPage() {
  const colors = useTheme();
  const { theme } = useThemeContext();
  // Semantic per-persona accent: Insight Driven=purple, Mechanistic Analyst=blue,
  // Neutral=green. Same three hues reappear on the tagline keywords and the
  // dataset cards, so the user learns one color language. Legacy keeps its OG
  // blue / green / teal rotation per the frozen-legacy rule.
  const PERSONA_ACCENT_INDEX: Record<string, number> = {
    insight_driven: 0,
    mechanistic_analyst: 3,
    neutral_evaluator: 6,
  };
  const legacyAccents = useMemo(
    () => [colors.firstColor, colors.thirdColor, colors.fourthColor],
    [colors]
  );
  const [personas, setPersonas] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    fetch("/api/personas")
      .then((res) => res.json())
      .then((data) => {
        const enriched = data.map((p: any, index: number) => {
          const accent =
            theme === "legacy"
              ? legacyAccents[index % legacyAccents.length]
              : colors.headingAccents[PERSONA_ACCENT_INDEX[p.id] ?? 6];
          const IconComponent = iconList[index % iconList.length];
          const iconName = iconNames[index % iconNames.length];

          return {
            ...p,
            accentColor: accent,
            iconName,
            icon: <IconComponent size={28} weight="bold" color={accent} />,
          };
        });

        setPersonas(enriched);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const navigate = (id: string) => {
    const selected = personas.find((p) => p.id === id);
    if (!selected) return;
    const params = new URLSearchParams({
      persona: id,
      personaName: selected.name ?? "",
      accentColor: selected.accentColor ?? "",
      icon: selected.iconName ?? "User",
    });
    router.push(`/pages/task?${params.toString()}`);
  };

  return (
    <CardsPage
      banner={{
        title: "Explanation Mode Setup",
        description:
          "Choose an explanation mode, or switch to the automatic questionnaire.",
        buttonText: "Automatic Questionnaire",
        buttonHref: "/pages/profile",
        icon: User,
      }}
    >
      {personas.map((p, i) => (
        <PersonaCard
          key={p.id ?? i}
          persona={p}
          isSelected={selectedId === p.id}
          onSelect={setSelectedId}
          onDoubleClick={() => navigate(p.id)}
          onConfirm={() => navigate(p.id)}
        />
      ))}
    </CardsPage>
  );
}