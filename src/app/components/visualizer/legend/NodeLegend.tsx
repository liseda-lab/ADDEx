"use client";
import React, { useRef, useState } from "react";
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
  // Display-only overrides for type names, keyed by raw type. The graph and the
  // pair resolution keep using the real types; this only relabels the legend
  // (and therefore the export, which captures this DOM).
  customLabels: Record<string, string>;
  onRenameType: (type: string, label: string) => void;
  // The legend's heading, also user-editable and display-only.
  title: string;
  onTitleChange: (next: string) => void;
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
  customLabels,
  onRenameType,
  title,
  onTitleChange,
}: NodeLegendProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const startTitleEdit = () => {
    setTitleDraft(title);
    setEditingTitle(true);
  };
  const commitTitle = () => {
    onTitleChange(titleDraft);
    setEditingTitle(false);
  };

  const defaultLabelFor = (type: string) =>
    type === "LCA" ? "Lowest Common Ancestor" : type.replace(/_/g, " ");
  const labelFor = (type: string) => customLabels[type] ?? defaultLabelFor(type);

  const startEditing = (type: string) => {
    setDraft(labelFor(type));
    setEditingType(type);
  };
  // Committing an empty value clears the override and restores the real type
  // name, so there is a way back without a separate reset control.
  const commitEditing = (type: string) => {
    onRenameType(type, draft);
    setEditingType(null);
  };

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
        /* Hint that labels are editable, without adding a per-row button. */
        .legend-label {
          position: relative;
        }
        .legend-label:hover {
          text-decoration: underline dotted;
          text-underline-offset: 2px;
        }
        .legend-label::after {
          content: "Click to rename";
          position: absolute;
          bottom: calc(100% + 6px);
          left: 0;
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
        .legend-label:hover::after {
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
          /* Left-aligned to the swatch rather than centred on it: the legend
             sits at the left edge of the canvas, so a centred tooltip hangs off
             the panel and gets clipped. Growing rightwards keeps it on screen. */
          left: 0;
          transform: none;
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

      {editingTitle ? (
        <input
          autoFocus
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitTitle();
            if (e.key === "Escape") setEditingTitle(false);
          }}
          // Keep clicks/drags inside the field from reaching the Rnd drag layer.
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          aria-label="Rename legend title"
          style={{
            fontSize: titleSize,
            fontWeight: "bold",
            width: Math.max(80, 100 * scale),
            padding: "0 2px",
            border: "1px solid #888",
            borderRadius: 2,
            background: "#fff",
            color: "#000",
            fontFamily: "inherit",
          }}
        />
      ) : (
        <h4
          className="legend-label"
          // stopPropagation, like the swatch does: the card is a react-rnd drag
          // surface and swallows the event otherwise, so the click never lands.
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            startTitleEdit();
          }}
          style={{
            margin: 0,
            fontWeight: "bold",
            fontSize: titleSize,
            cursor: "text",
            width: "fit-content",
          }}
        >
          {title}
        </h4>
      )}

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
                {editingType === type ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitEditing(type)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEditing(type);
                      if (e.key === "Escape") setEditingType(null);
                    }}
                    // Keep clicks/drags inside the field off the Rnd drag layer.
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Rename ${defaultLabelFor(type)}`}
                    style={{
                      fontSize: labelSize,
                      lineHeight: 1.3,
                      width: Math.max(70, 90 * scale),
                      padding: "0 2px",
                      border: "1px solid #888",
                      borderRadius: 2,
                      background: "#fff",
                      color: "#000",
                      // fontFamily only. The `font` shorthand would reset
                      // font-size to the inherited value and undo labelSize
                      // above, making the field jump to ~16px on edit.
                      fontFamily: "inherit",
                    }}
                  />
                ) : (
                <div
                  className="legend-label"
                  // Single click, matching the swatch beside it (which opens the
                  // colour picker on one click). Double-click was undiscoverable
                  // and inconsistent with its own neighbour. stopPropagation for
                  // the same reason the swatch does it: react-rnd owns pointer
                  // events on this card and would otherwise eat the click.
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(type);
                  }}
                  style={{
                    fontSize: labelSize,
                    lineHeight: 1.3,
                    cursor: "text",
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
                  {labelFor(type)}
                </div>
                )}
              </div>
            );
          })}
      </div>

    </div>
  );
}
