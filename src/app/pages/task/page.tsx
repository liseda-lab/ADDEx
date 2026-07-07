"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Database } from "phosphor-react";
import CardsPage from "../../components/general/CardsPage";
import DatasetCard from "./DatasetCard";
import EntityAvailability from "../guide/EntityAvailability";
import { useTheme } from "../../../../styles/ThemeContext";

export default function DatasetPage() {
  const colors = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [datasets, setDatasets] = useState<any[]>([]);

  // Preserve the persona the user picked so clicking the example link on this
  // page lands them on search with their chosen explanation mode still active.
  const exampleHref = (() => {
    const params = new URLSearchParams();
    params.set("viaQuickSkip", "true");
    const currentParams = searchParams.toString();
    if (currentParams) {
      const existing = new URLSearchParams(currentParams);
      ["persona", "personaName", "accentColor", "icon"].forEach((key) => {
        const value = existing.get(key);
        if (value) params.set(key, value);
      });
    }
    return `/pages/search?${params.toString()}`;
  })();

  useEffect(() => {
    let mounted = true;

    fetch("/api/datasets")
      .then(async (res) => {
        if (!res.ok) return [];

        const text = await res.text();
        if (!text) return [];

        try {
          const parsed = JSON.parse(text);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })
      .then((data) => {
        if (mounted) setDatasets(data);
      })
      .catch(() => {
        if (mounted) setDatasets([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <CardsPage
      banner={{
        title: "Dataset Selection",
        description:
          "Choose a knowledge graph and the task ADDEx should run on it.",
        icon: Database,
      }}
      topActions={
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            background: "transparent",
            border: "none",
            color: `${colors.white}99`,
            fontSize: "0.82rem",
            cursor: "pointer",
            textDecoration: "underline",
            padding: "0.25rem 0.5rem",
          }}
        >
          ← Back to profiles
        </button>
      }
      outro={
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <p
            style={{
              margin: 0,
              color: `${colors.white}c0`,
              fontSize: "0.85rem",
              lineHeight: 1.5,
            }}
          >
            Not sure a dataset has your drug, disease, gene or protein? Check
            here:
          </p>
          <EntityAvailability />
        </div>
      }
      actions={
        <Link
          href={exampleHref}
          style={{
            color: colors.gray,
            fontSize: "0.82rem",
            textDecoration: "none",
            padding: "0.4rem 0.6rem",
            borderRadius: 6,
            transition: "color 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = "underline";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = "none";
          }}
        >
          Not sure which dataset? → Try our examples first
        </Link>
      }
    >
      {datasets.map((dataset, index) => (
        <DatasetCard
          key={dataset.name}
          dataset={dataset}
          index={index}
        />
      ))}
    </CardsPage>
  );
}
