"use client";

import { useEffect, useState } from "react";
import { MagnifyingGlass, X } from "phosphor-react";
import { useTheme } from "../../../../styles/ThemeContext";
import EntityAvailability from "./EntityAvailability";

interface Props {
  label?: string;
  compact?: boolean;
  // Render as a small round icon-only button (used as a corner button on the
  // search page, where a full-width labelled button overlaps the graph toolbar).
  iconOnly?: boolean;
}

// Small trigger that opens the entity-availability checker in a modal. Used on
// the search page so users can check dataset coverage without leaving the flow.
export default function EntityAvailabilityLauncher({
  label = "Which dataset has my entity?",
  compact = false,
  iconOnly = false,
}: Props) {
  const colors = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={iconOnly ? label : undefined}
        aria-label={iconOnly ? label : undefined}
        style={
          iconOnly
            ? {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: `1px solid ${colors.white}30`,
                background: colors.card,
                color: colors.white,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(0,0,0,0.22)",
              }
            : {
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: compact ? "0.35rem 0.65rem" : "0.5rem 0.9rem",
                borderRadius: 8,
                border: "none",
                background: colors.buttons,
                color: "#FFFFFF",
                fontSize: compact ? "0.76rem" : "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              }
        }
      >
        <MagnifyingGlass
          size={iconOnly ? 18 : 14}
          weight="bold"
          aria-hidden="true"
        />
        {iconOnly ? null : label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Which dataset has my entity?"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "6vh 1rem 1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              background: colors.card,
              border: `1px solid ${colors.white}22`,
              borderRadius: 14,
              padding: "1rem 1.15rem 1.2rem",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              maxHeight: "84vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                marginBottom: "0.8rem",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: colors.white,
                  fontSize: "1rem",
                  fontWeight: 700,
                }}
              >
                Which dataset has my entity?
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  color: colors.white,
                  cursor: "pointer",
                  padding: 4,
                  display: "inline-flex",
                }}
              >
                <X size={18} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <EntityAvailability bare />
          </div>
        </div>
      )}
    </>
  );
}
