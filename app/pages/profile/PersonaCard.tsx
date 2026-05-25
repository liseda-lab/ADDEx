"use client";
import { Persona } from "./persona";
import { useTheme } from "../../../../styles/ThemeContext";

interface PersonaCardProps {
  persona: Persona;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDoubleClick?: () => void;
  onConfirm?: () => void;
}

// Curated copy matching the Guide page, keyed by persona id, so the manual
// selector and the Guide read the same characterization. The API payload is
// kept for legacy/unknown personas. When an override matches, `alsoValues`
// is omitted, the Guide card doesn't have that section, and showing it here
// would break parity.
const PERSONA_OVERRIDES: Record<
  string,
  { tagline: string; profile: string }
> = {
  mechanistic_analyst: {
    tagline: "Detailed step-by-step reasoning",
    profile:
      "Favours long, fully grounded paths with multiple evidence layers and rich ontological enrichment. Choose this when you want to inspect the full biological mechanism.",
  },
  insight_driven: {
    tagline: "Concise, pivotal connection",
    profile:
      "Prefers short explanations that surface the single most informative link. Choose this when you want the core insight at a glance rather than a full chain.",
  },
  neutral_evaluator: {
    tagline: "Uniform baseline",
    profile:
      "Ranks paths purely by information content and fidelity, without persona conditioning. Choose this to inspect an untuned baseline.",
  },
};

export default function PersonaCard({
  persona,
  isSelected,
  onSelect,
  onDoubleClick,
  onConfirm,
}: PersonaCardProps) {
  const colors = useTheme();
  const accent = persona.accentColor || colors.fourthColor;
  const override = PERSONA_OVERRIDES[persona.id];
  const tagline = override?.tagline ?? persona.tagline;
  const profile = override?.profile ?? persona.profile;
  const showAlsoValues = !override && persona.alsoValues;

  return (
    // Outer element is a div-acting-as-button because the Confirm button is a
    // real <button>; nesting real <button>s is invalid HTML. Full a11y via
    // role/tabIndex/aria-pressed and Enter/Space handlers.
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Select persona: ${persona.name}`}
      onClick={() => onSelect(persona.id)}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          // First Enter/Space selects the card; a second Enter/Space (while
          // already selected) confirms, mirrors double-click and lets
          // keyboard users reach navigation without Tabbing to the inline
          // "Select X" button.
          if (isSelected && onConfirm) {
            onConfirm();
          } else {
            onSelect(persona.id);
          }
        }
      }}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 12,
        background: colors.card,
        // Longhand on every side because the left border has its own
        // 3px-thick accent rule. Mixing `border` shorthand with `borderLeft`
        // longhand triggers a React 19 dev warning when isSelected toggles.
        borderTopWidth: 1,
        borderTopStyle: "solid",
        borderTopColor: isSelected ? accent : `${accent}60`,
        borderRightWidth: 1,
        borderRightStyle: "solid",
        borderRightColor: isSelected ? accent : `${accent}60`,
        borderBottomWidth: 1,
        borderBottomStyle: "solid",
        borderBottomColor: isSelected ? accent : `${accent}60`,
        borderLeftWidth: 3,
        borderLeftStyle: "solid",
        borderLeftColor: accent,
        boxShadow: isSelected
          ? `0 0 0 1px ${accent}55, 0 8px 24px ${accent}33`
          : "0 4px 20px rgba(0,0,0,0.3)",
        padding: "1rem 1.2rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        cursor: "pointer",
        transition:
          "box-shadow 0.18s ease, border-color 0.18s ease, transform 0.15s ease",
      }}
    >
      {/* Content wrapper, fades when selected + confirm is available so the
          centered "Select X" overlay reads clearly on top. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          flex: 1,
          opacity: isSelected && onConfirm ? 0.18 : 1,
          transition: "opacity 0.2s ease",
          pointerEvents: isSelected && onConfirm ? "none" : "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: 8,
              background: `${accent}22`,
              border: `1px solid ${accent}55`,
              color: accent,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {persona.icon}
          </span>
          <h3
            style={{
              margin: 0,
              color: accent,
              fontSize: "0.98rem",
              fontWeight: 700,
              lineHeight: 1.3,
            }}
          >
            {persona.name}
          </h3>
        </div>

        {tagline && (
          <p
            style={{
              margin: 0,
              color: `${colors.white}b0`,
              fontSize: "0.82rem",
              fontStyle: "italic",
              lineHeight: 1.4,
            }}
          >
            {tagline}
          </p>
        )}

        <p
          style={{
            margin: 0,
            color: colors.white,
            fontSize: "0.9rem",
            lineHeight: 1.6,
          }}
        >
          {profile}
        </p>

        {/* Also Values, only shown for personas without a Guide override. */}
        {showAlsoValues && (
          <p
            style={{
              margin: 0,
              color: `${colors.white}d0`,
              fontSize: "0.86rem",
              lineHeight: 1.55,
            }}
          >
            <span style={{ color: accent, fontWeight: 600 }}>Also values…</span>{" "}
            {persona.alsoValues}
          </p>
        )}
      </div>

      {/* Overlay Select button, centered over the faded content when this
          card is selected. Keyboard users reach it via Enter/Space on the
          already-selected card (see onKeyDown above). */}
      {isSelected && onConfirm && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            pointerEvents: "none",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            style={{
              padding: "0.75rem 1.6rem",
              borderRadius: 10,
              border: "none",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
              background: colors.buttons,
              color: "#FFFFFF",
              textAlign: "center",
              boxShadow: `0 8px 24px ${accent}90, 0 0 0 2px ${accent}55`,
              transition: "opacity 0.15s ease, transform 0.1s ease",
              pointerEvents: "auto",
              letterSpacing: "0.02em",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.92";
              e.currentTarget.style.transform = "scale(1.03)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            Select {persona.name}
          </button>
        </div>
      )}
    </div>
  );
}
