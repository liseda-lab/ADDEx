"use client";
import React, { useRef } from "react";
import { ArrowRight, ArrowDown } from "lucide-react";
import { useTheme } from "../../../../../styles/ThemeContext";

interface NodeLegendProps {
  getColorForType: (type: string) => string;
  updateColor: (type: string, color: string) => void;
  resetColors: () => void;
  activeTypes: string[];
  openColorPicker: (type: string, position: { x: number; y: number }) => void;
  isColumnLayout: boolean;
  onToggleLayout: () => void;
}

export default function NodeLegend({
  getColorForType,
  activeTypes,
  openColorPicker,
  isColumnLayout,
  onToggleLayout,
}: NodeLegendProps) {
  const colors = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSquareClick = (type: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = rect.left + e.currentTarget.offsetLeft;
    const y = rect.top + e.currentTarget.offsetTop + e.currentTarget.clientHeight;
    openColorPicker(type, { x, y });
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        padding: "0.5rem 1rem",
        color: "#000",
        width: "fit-content",
        height: "fit-content",
        boxSizing: "border-box",
        overflow: "visible",
      }}
    >
      <style>{`
        .legend-swatch {
          position: relative;
        }
        .legend-swatch:hover {
          transform: scale(1.25);
          border-color: #000 !important;
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.15);
        }
        .legend-swatch:active {
          transform: scale(1.1);
        }
        .legend-swatch::after {
          content: "Change color";
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          background: #333;
          color: #fff;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.08s ease;
          z-index: 10;
        }
        .legend-swatch:hover::after {
          opacity: 1;
        }
      `}</style>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "0.75rem",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h4 style={{ margin: 0, fontWeight: "bold", fontSize: 14 }}>Node Types</h4>
        <div
          data-export-hide="true"
          style={{ position: "relative" }}
          onMouseEnter={(e) => {
            const tip = e.currentTarget.querySelector(".legend-layout-tooltip") as HTMLElement | null;
            if (tip) tip.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            const tip = e.currentTarget.querySelector(".legend-layout-tooltip") as HTMLElement | null;
            if (tip) tip.style.opacity = "0";
          }}
        >
          <button
            type="button"
            onClick={onToggleLayout}
            title={isColumnLayout ? "Switch to row layout" : "Switch to column layout"}
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              border: `1px solid ${colors.white}30`,
              backgroundColor: colors.darkblue,
              color: colors.white,
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
              flexShrink: 0,
            }}
          >
            {isColumnLayout ? <ArrowRight size={14} /> : <ArrowDown size={14} />}
          </button>
          <span
            className="legend-layout-tooltip"
            style={{
              position: "absolute",
              top: "110%",
              right: 0,
              backgroundColor: "#333",
              color: "#fff",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 10,
              whiteSpace: "nowrap",
              zIndex: 200,
              pointerEvents: "none",
              opacity: 0,
              transition: "opacity 0.2s",
            }}
          >
            {isColumnLayout ? "Switch to row layout" : "Switch to column layout"}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: isColumnLayout ? "column" : "row",
          gap: "0.75rem",
          flexWrap: isColumnLayout ? "nowrap" : "wrap",
          alignItems: isColumnLayout ? "flex-start" : "center",
        }}
      >
        {Array.from(new Set(activeTypes.filter(Boolean)))
          .sort((a, b) => (a === "LCA" ? 1 : b === "LCA" ? -1 : 0)) // LCA goes last
          .map((type) => {
            const isLCA = type === "LCA";
            return (
              <div
                key={type}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  // Top-align so the swatch sits on the first text line for
                  // labels that wrap (e.g. "Lowest Common Ancestor" on two
                  // lines). The swatch's marginTop nudges it into the
                  // cap-height of that first line.
                  alignItems: "flex-start",
                  gap: "0.4rem",
                  minWidth: 0,
                }}
              >
                <div
                  className="legend-swatch"
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    backgroundColor: getColorForType(type),
                    cursor: "pointer",
                    border: "1px solid #555",
                    flexShrink: 0,
                    boxSizing: "border-box",
                    marginTop: 2,
                    transition:
                      "transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease",
                  }}
                  onClick={(e) => handleSquareClick(type, e)}
                />
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.3,
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                    maxWidth: isLCA ? "100%" : 160,
                  }}
                >
                  {isLCA ? "Lowest Common Ancestor" : type.replace(/_/g, " ")}
                </div>
              </div>
            );
          })}
      </div>

    </div>
  );
}
