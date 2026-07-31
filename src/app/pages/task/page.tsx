"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Database } from "phosphor-react";
import CardsPage from "../../components/general/CardsPage";
import DatasetCard from "./DatasetCard";
import EntityAvailabilityLauncher from "../guide/EntityAvailabilityLauncher";
import ExamplePairCards, {
  EXAMPLE_PAIRS,
} from "../../components/general/ExamplePairCards";
import { useTheme } from "../../../../styles/ThemeContext";

export default function DatasetPage() {
  const colors = useTheme();
  const router = useRouter();
  const [datasets, setDatasets] = useState<any[]>([]);

  // ExamplePairCards builds its own hrefs and reads the persona straight from
  // the query string, so the old hand-rolled example link is no longer needed.

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
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
          {/* Lookup lives top-right as a reference tool, not in the flow below
              the dataset cards. */}
          <EntityAvailabilityLauncher dropdown iconOnly withLabel />
        </div>
      }
      actions={
        <div style={{ width: "100%", maxWidth: 780 }}>
          <ExamplePairCards
            examples={EXAMPLE_PAIRS}
            heading="Not sure which dataset? Try an example"
            compact
          />
        </div>
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
