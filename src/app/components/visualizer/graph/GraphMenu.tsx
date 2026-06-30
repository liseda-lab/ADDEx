"use client";

import React, { useState, forwardRef, useImperativeHandle, JSX, useEffect, useRef } from "react";
import { Core } from "cytoscape";
import { useTheme } from "../../../../../styles/ThemeContext";
import type { ThemeName } from "../../../../../styles/themes";
import { ZoomIn, ZoomOut, RefreshCcw, Settings, Grid, Target, Download, Palette, RotateCcw, Menu, X } from "lucide-react";
import EditGraphMenu from "../Settings/GraphSettings";
import { Pair } from "@/app/hooks/types";

export interface GraphMenuProps {
  cy: Core | null;
  onReload: () => void;
  pair: Pair;
  onExport: () => void;
  paletteOverride: ThemeName | null;
  setPaletteOverride: (next: ThemeName | null) => void;
  resetColors: () => void;
}

const PALETTE_OPTIONS: { value: ThemeName | "auto"; label: string }[] = [
  { value: "auto", label: "Match theme" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "legacy", label: "Legacy" },
  { value: "highContrast", label: "High contrast" },
  { value: "colorBlind", label: "Color-blind safe" },
];

const NOOP = () => {};

const GraphMenu = forwardRef<() => void, GraphMenuProps>(({
  cy,
  onReload,
  pair,
  onExport,
  paletteOverride = null,
  setPaletteOverride = NOOP,
  resetColors = NOOP,
}, ref) => {
  const colors = useTheme();

  const [editOpen, setEditOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const controlsMeasureRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateCompact = () => {
      const headerWidth = headerRef.current?.clientWidth ?? 0;
      const titleWidth = titleRef.current?.clientWidth ?? 0;
      const controlsWidth = controlsMeasureRef.current?.scrollWidth ?? 0;
      // Horizontal padding + a small safety gap between title and controls.
      const chromeAllowance = 48;
      const needsCompact =
        headerWidth > 0 &&
        titleWidth > 0 &&
        controlsWidth > 0 &&
        titleWidth + controlsWidth + chromeAllowance > headerWidth;
      setIsCompact(needsCompact);
    };

    updateCompact();
    window.addEventListener("resize", updateCompact);

    let ro: ResizeObserver | null = null;
    if (headerRef.current && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => updateCompact());
      ro.observe(headerRef.current);
      if (titleRef.current) ro.observe(titleRef.current);
      if (controlsMeasureRef.current) ro.observe(controlsMeasureRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateCompact);
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isCompact) setMenuOpen(false);
  }, [isCompact]);

  // --------------------- CENTER FUNCTION ---------------------
  const handleCenter = () => {
    if (cy) {
      cy.fit();
      cy.center();
    }
  };

  useImperativeHandle(ref, () => handleCenter);

  const handleReload = () => {
    onReload();
  };

  const handleExportClick = () => {
    if (!pair) return alert("No hypothesis selected for export!");
    onExport();
  };

  const handleZoomIn = () => {
    if (cy)
      cy.zoom({
        level: cy.zoom() * 1.2,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }
      });
  };

  const handleZoomOut = () => {
    if (cy)
      cy.zoom({
        level: cy.zoom() * 0.8,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }
      });
  };

  const handleGridToggle = () => {
    if (!cy) return;

    const newShowGrid = !showGrid;
    setShowGrid(newShowGrid);

    const gridSize = 20;

    if (newShowGrid) {
      cy.container()!.style.backgroundImage =
        `linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
         linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)`;

      cy.container()!.style.backgroundSize = `${gridSize}px ${gridSize}px`;
      cy.container()!.style.backgroundColor = "#fff";
    } else {
      cy.container()!.style.backgroundImage = "none";
      cy.container()!.style.backgroundColor = "transparent";
    }
  };

  const handleEditToggle = () => setEditOpen(!editOpen);

  const buttonStyle = {
    padding: "4px 10px",
    backgroundColor: colors.darkblue,
    color: colors.white,
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontWeight: 600,
    fontSize: 13,
    position: "relative" as const
  };

  const iconButtonStyle = {
    ...buttonStyle,
    padding: "6px 8px",
  };

  const Tooltip = ({ text }: { text: string }) => (
    <span
      style={{
        position: "absolute",
        top: "110%",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: "#333",
        color: "#fff",
        padding: "2px 6px",
        borderRadius: 4,
        fontSize: 10,
        whiteSpace: "nowrap",
        zIndex: 200,
        pointerEvents: "none",
        opacity: 0,
        transition: "opacity 0.2s"
      }}
      className="tooltip"
    >
      {text}
    </span>
  );

  const renderButton = (
    onClick: () => void,
    icon: JSX.Element,
    tooltip: string,
    label?: JSX.Element | string
  ) => (
    <div
      style={{ position: "relative" }}
      onMouseEnter={e => {
        const tip = e.currentTarget.querySelector(".tooltip") as HTMLElement;
        if (tip) tip.style.opacity = "1";
      }}
      onMouseLeave={e => {
        const tip = e.currentTarget.querySelector(".tooltip") as HTMLElement;
        if (tip) tip.style.opacity = "0";
      }}
    >
      <button
        onClick={onClick}
        style={{
          ...buttonStyle,
          ...(isCompact
            ? {
                width: "100%",
                justifyContent: "flex-start",
              }
            : null),
        }}
      >
        {icon}
        {label && <span style={{ marginLeft: 4 }}>{label}</span>}
      </button>
      <Tooltip text={tooltip} />
    </div>
  );

  return (
    <>
      <div
        ref={headerRef}
        style={{
          padding: "0.5rem 1rem",
          position: "relative",
          zIndex: 30,
          overflow: "visible",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#fafafa",
          borderBottom: "1px solid #ccc"
        }}
      >
        <h4 ref={titleRef} style={{ margin: 0, fontSize: 16, fontWeight: 'bold', color: '#1F2433' }}>Visualization</h4>

        {isCompact ? (
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={iconButtonStyle}
            aria-label={menuOpen ? "Close graph menu" : "Open graph menu"}
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            ...(isCompact
              ? {
                  position: "absolute" as const,
                  top: "100%",
                  right: "0.75rem",
                  marginTop: "0.35rem",
                  padding: "0.55rem",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  backgroundColor: "#fafafa",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
                  flexDirection: "column" as const,
                  alignItems: "stretch",
                  minWidth: 220,
                  zIndex: 50,
                  display: menuOpen ? "flex" : "none",
                }
              : null),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 6px 2px 8px",
              borderRadius: 4,
              backgroundColor: colors.darkblue,
              color: colors.white,
            }}
            title="Pick the palette used for node colors. 'Match theme' follows the app theme."
          >
            <Palette size={14} aria-hidden="true" />
            <select
              aria-label="Node color palette"
              value={paletteOverride ?? "auto"}
              onChange={(e) => {
                const next = e.target.value;
                setPaletteOverride(next === "auto" ? null : (next as ThemeName));
              }}
              style={{
                background: "transparent",
                color: colors.white,
                border: "none",
                outline: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                paddingRight: 4,
              }}
            >
              {PALETTE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} style={{ color: "#222" }}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {renderButton(
            resetColors,
            <RotateCcw size={16} />,
            "Reset node colors",
            isCompact ? "Reset node colors" : undefined
          )}
          {renderButton(
            handleExportClick,
            <Download size={16} />,
            "Export graph",
            isCompact ? "Export graph" : undefined
          )}
          {renderButton(
            handleCenter,
            <Target size={16} />,
            "Center graph",
            isCompact ? "Center graph" : undefined
          )}
          {renderButton(
            handleReload,
            <RefreshCcw size={16} />,
            "Reload graph",
            isCompact ? "Reload graph" : undefined
          )}
          {renderButton(
            handleZoomIn,
            <ZoomIn size={16} />,
            "Zoom in",
            isCompact ? "Zoom in" : undefined
          )}
          {renderButton(
            handleZoomOut,
            <ZoomOut size={16} />,
            "Zoom out",
            isCompact ? "Zoom out" : undefined
          )}
          {renderButton(
            handleGridToggle,
            <Grid size={16} />,
            "Toggle grid",
            isCompact ? "Toggle grid" : undefined
          )}
          {renderButton(
            handleEditToggle,
            <Settings size={16} />,
            "Settings",
            isCompact ? "Settings" : undefined
          )}
        </div>

        {/* Hidden desktop-controls measurer used to decide if compact mode is needed */}
        <div
          ref={controlsMeasureRef}
          style={{
            position: "absolute",
            visibility: "hidden",
            pointerEvents: "none",
            height: 0,
            overflow: "hidden",
            whiteSpace: "nowrap",
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
          }}
          aria-hidden="true"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 6px 2px 8px",
              borderRadius: 4,
              backgroundColor: colors.darkblue,
              color: colors.white,
            }}
          >
            <Palette size={14} aria-hidden="true" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Match theme</span>
          </div>
          <button style={buttonStyle}><RotateCcw size={16} /></button>
          <button style={buttonStyle}><Download size={16} /></button>
          <button style={buttonStyle}><Target size={16} /></button>
          <button style={buttonStyle}><RefreshCcw size={16} /></button>
          <button style={buttonStyle}><ZoomIn size={16} /></button>
          <button style={buttonStyle}><ZoomOut size={16} /></button>
          <button style={buttonStyle}><Grid size={16} /></button>
          <button style={buttonStyle}><Settings size={16} /></button>
        </div>
      </div>

      <EditGraphMenu open={editOpen} onClose={() => setEditOpen(false)} cy={cy} />
    </>
  );
});

GraphMenu.displayName = "GraphMenu";
export default GraphMenu;
