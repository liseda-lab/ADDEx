"use client";
import React, { useRef } from "react";
import { ArrowRight, ArrowDown, Minus, Plus } from "lucide-react";

// Scale bounds shared with GraphVisualizer, which maps vertical resize-drags
// onto the same factor the -/+ buttons step through.
export const LEGEND_SCALE_MIN = 0.7;
export const LEGEND_SCALE_MAX = 1.6;
export const LEGEND_SCALE_STEP = 0.1;

interface NodeLegendProps {
  getColorForType: (type: string) => string;
  updateColor: (type: string, color: string) => void;
  resetColors: () => void;
  activeTypes: string[];
  openColorPicker: (type: string, position: { x: number; y: number }) => void;
  isColumnLayout: boolean;
  onToggleLayout: () => void;
  scale: number;
  onScaleChange: (next: number) => void;
  // True while the card hugs its content (no width pinned by dragging). Drives
  // whether long labels are capped to force a wrap, or free to use the width
  // the user dragged to.
  autoWidth: boolean;
}

export default function NodeLegend({
  getColorForType,
  activeTypes,
  openColorPicker,
  isColumnLayout,
  onToggleLayout,
  scale,
  onScaleChange,
  autoWidth,
}: NodeLegendProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Legend text scale, owned by GraphVisualizer so a vertical resize-drag can
  // drive the same value. The export draws the legend at 1:1, so whatever is
  // picked here is exactly what lands in the PNG/PDF. Base sizes are the 100%
  // values.
  const SCALE_MIN = LEGEND_SCALE_MIN;
  const SCALE_MAX = LEGEND_SCALE_MAX;
  const STEP = LEGEND_SCALE_STEP;
  const bump = (delta: number) =>
    onScaleChange(
      Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round((scale + delta) * 10) / 10))
    );
  const titleSize = 11 * scale;
  const labelSize = 11 * scale;
  const swatchSize = 10 * scale;

  // Ghost buttons: these float outside the card (see .legend-controls) so the
  // card itself matches the export 1:1, and they stay faded until the legend is
  // hovered so they do not compete with the graph.
  const stepButtonStyle: React.CSSProperties = {
    width: 18,
    height: 18,
    borderRadius: 4,
    border: "1px solid #c8c8c8",
    backgroundColor: "rgba(255,255,255,0.92)",
    color: "#444",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    flexShrink: 0,
  };

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
      className="legend-root"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "0.3rem",
        padding: "0.35rem 0.5rem",
        color: "#000",
        width: "fit-content",
        height: "fit-content",
        boxSizing: "border-box",
        overflow: "visible",
      }}
    >
      <style>{`
        /* Sit just below the card, right-aligned, outside its border. Below
           rather than above: the legend defaults to the top-left of the canvas,
           so anything above it is clipped by the Visualization header. The Rnd
           wrapper has no overflow clipping, so this renders over the graph
           rather than inside the legend. */
        .legend-controls {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          display: flex;
          align-items: center;
          gap: 4px;
          z-index: 5;
          /* Always visible, just muted, so the controls are discoverable
             without hunting for them. They come to full strength on hover. */
          opacity: 0.6;
          transition: opacity 0.15s ease;
        }
        .legend-root:hover .legend-controls,
        .legend-controls:focus-within {
          opacity: 1;
        }
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
      {/* Controls live outside the card: they are export-hidden, so keeping them
          off the card means what you see on screen is exactly what you export. */}
      <div className="legend-controls" data-export-hide="true">
        <button
          type="button"
          onClick={() => bump(-STEP)}
          disabled={scale <= SCALE_MIN}
          title="Smaller legend"
          aria-label="Smaller legend"
          style={{
            ...stepButtonStyle,
            opacity: scale <= SCALE_MIN ? 0.35 : 1,
            cursor: scale <= SCALE_MIN ? "default" : "pointer",
          }}
        >
          <Minus size={11} />
        </button>
        <button
          type="button"
          onClick={() => bump(STEP)}
          disabled={scale >= SCALE_MAX}
          title="Larger legend"
          aria-label="Larger legend"
          style={{
            ...stepButtonStyle,
            opacity: scale >= SCALE_MAX ? 0.35 : 1,
            cursor: scale >= SCALE_MAX ? "default" : "pointer",
          }}
        >
          <Plus size={11} />
        </button>
        <button
          type="button"
          onClick={onToggleLayout}
          title={isColumnLayout ? "Switch to row layout" : "Switch to column layout"}
          aria-label={
            isColumnLayout ? "Switch to row layout" : "Switch to column layout"
          }
          style={stepButtonStyle}
        >
          {isColumnLayout ? <ArrowRight size={11} /> : <ArrowDown size={11} />}
        </button>
      </div>

      <h4 style={{ margin: 0, fontWeight: "bold", fontSize: titleSize }}>
        Node Types
      </h4>

      <div
        style={{
          display: "flex",
          flexDirection: isColumnLayout ? "column" : "row",
          gap: "0.4rem",
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
                    width: swatchSize,
                    height: swatchSize,
                    borderRadius: 2,
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
                    fontSize: labelSize,
                    lineHeight: 1.3,
                    // Row mode lays the items out side by side, so every label
                    // stays on one line and the legend grows horizontally.
                    whiteSpace: isColumnLayout ? "normal" : "nowrap",
                    wordBreak: isColumnLayout ? "break-word" : "normal",
                    // Column mode, auto width: cap "Lowest Common Ancestor" to
                    // force a second line and keep the card narrow (a % cap
                    // would resolve to auto against a fit-content parent, so it
                    // would never wrap). Once a width is pinned by dragging, or
                    // in row mode, drop the cap so labels use the space
                    // available: drag right and the label returns to one line.
                    maxWidth:
                      autoWidth && isColumnLayout
                        ? isLCA
                          ? 90 * scale
                          : 140 * scale
                        : "100%",
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
