"use client";
import React, { useState, useEffect } from "react";
import { Core } from "cytoscape";
import NodeSettings from "./NodeSettings";
import EdgeSettings from "./EdgeSettings";
import LayoutSettings from "./LayoutSettings";
import { getGraphSettings, setGraphSettings } from "@/app/hooks/graphSettings";
import { runClusterLayoutByType } from "@/app/hooks/clusterLayout";
import graphStyles from "@/app/hooks/graphStyles";
import { normalizeNodeType } from "../../../../../styles/typeKey";
import { useTheme } from "../../../../../styles/ThemeContext";

interface EditGraphMenuProps {
  open: boolean;
  onClose: () => void;
  cy: Core | null;
}

export default function EditGraphMenu({ open, onClose, cy }: EditGraphMenuProps) {
  const colors = useTheme();
  const savedSettings = getGraphSettings();

  const [neNodeShape, setNeNodeShape] = useState<string>(
    savedSettings.neNodeShape ?? "roundrectangle"
  );
  const [lcaNodeShape, setLcaNodeShape] = useState<string>(
    savedSettings.lcaNodeShape ?? "roundrectangle"
  );
  const [neBorderStyle, setNeBorderStyle] = useState<string>(
    savedSettings.neBorderStyle ?? "solid"
  );
  const [lcaBorderStyle, setLcaBorderStyle] = useState<string>(
    savedSettings.lcaBorderStyle ?? "dashed"
  );
  const [edgeThickness, setEdgeThickness] = useState<number>(savedSettings.edgeThickness);
  const [arrowShape, setArrowShape] = useState<string>(savedSettings.arrowShape);
  const [neLineStyle, setNeLineStyle] = useState<string>(savedSettings.neLineStyle);
  const [lcaLineStyle, setLcaLineStyle] = useState<string>(savedSettings.lcaLineStyle);
  const [neEdgeColor, setNeEdgeColor] = useState<string>(savedSettings.neEdgeColor ?? "#000000");
  const [lcaEdgeColor, setLcaEdgeColor] = useState<string>(
    savedSettings.lcaEdgeColor ?? "#8a8a8a"
  );
  const [layoutName, setLayoutName] = useState<string>(savedSettings.layoutName ?? "breadthfirst");

  // Sync current graph styles when menu opens
  useEffect(() => {
    if (!open || !cy) return;

    // Set node shape based on saved settings
    setNeNodeShape(savedSettings.neNodeShape ?? "roundrectangle");
    setLcaNodeShape(savedSettings.lcaNodeShape ?? "roundrectangle");
    setNeBorderStyle(savedSettings.neBorderStyle ?? "solid");
    setLcaBorderStyle(savedSettings.lcaBorderStyle ?? "dashed");
    setEdgeThickness(savedSettings.edgeThickness);
    setArrowShape(savedSettings.arrowShape);
    setNeLineStyle(savedSettings.neLineStyle);
    setLcaLineStyle(savedSettings.lcaLineStyle);
    setNeEdgeColor(savedSettings.neEdgeColor ?? "#000000");
    setLcaEdgeColor(savedSettings.lcaEdgeColor ?? "#8a8a8a");
    setLayoutName(savedSettings.layoutName ?? "breadthfirst");
  }, [open]);

  const handleSave = () => {
    if (!cy) return;
    const previousSettings = getGraphSettings();

    // Update node styles
    cy.nodes().forEach((node) => {
      const type = String(node.data("type") ?? "").toLowerCase();
      const isLca = type === "lca";
      void node.style("shape", isLca ? lcaNodeShape : neNodeShape);
      void node.style("border-style", isLca ? lcaBorderStyle : neBorderStyle);
    });

    // Update edge styles
    cy.edges().forEach((edge) => {
      const type = edge.data("type");
      const isLca = String(type).toLowerCase() === "lca";
      void edge.style("width", edgeThickness);
      void edge.style("target-arrow-shape", arrowShape);
      void edge.style("line-color", isLca ? lcaEdgeColor : neEdgeColor);
      void edge.style("target-arrow-color", isLca ? lcaEdgeColor : neEdgeColor);
      void edge.style("source-arrow-color", isLca ? lcaEdgeColor : neEdgeColor);
      void edge.style("color", isLca ? lcaEdgeColor : neEdgeColor);

      if (isLca) {
        void edge.style("line-style", lcaLineStyle);
        // Flip arrow: point to source instead of target
        void edge.style("target-arrow-shape", "none");
        void edge.style("source-arrow-shape", arrowShape);
      } else {
        void edge.style("line-style", neLineStyle);
        void edge.style("target-arrow-shape", arrowShape);
        void edge.style("source-arrow-shape", "none");
      }
    });

    // Save settings to external file
    setGraphSettings({
      neNodeShape,
      lcaNodeShape,
      neBorderStyle,
      lcaBorderStyle,
      edgeThickness,
      arrowShape,
      neLineStyle,
      lcaLineStyle,
      neEdgeColor,
      lcaEdgeColor,
      layoutName,
    });

    // Reapply full stylesheet so NE/LCA style settings persist and aren't
    // overridden by subsequent style refreshes in GraphVisualizer.
    const nodeTypeColors: Record<string, string> = {};
    cy.nodes().forEach((node) => {
      const t = normalizeNodeType(String(node.data("type") ?? ""));
      if (!(t in nodeTypeColors)) {
        nodeTypeColors[t] = String(node.style("background-color") || "#ffffff");
      }
    });
    cy.style(graphStyles(nodeTypeColors, cy.elements().map((el) => el.json())));

    // Re-run layout only when the user explicitly changed it.
    if ((previousSettings.layoutName ?? "breadthfirst") !== layoutName) {
      if (layoutName === "cluster" || layoutName === "cose") {
        runClusterLayoutByType(cy);
        onClose();
        return;
      }

      const layoutOptions =
        layoutName === "hierarchical"
          ? {
              name: "breadthfirst",
              directed: false,
              roots: cy.nodes().filter((node) => String(node.data("type")) === "LCA"),
              spacingFactor: 1,
              avoidOverlap: true,
              animate: true,
              direction: "downward",
            }
          : layoutName === "hierarchicalClassic"
          ? {
              name: "breadthfirst",
              directed: true,
              spacingFactor: 1,
              avoidOverlap: true,
              animate: true,
              direction: "downward",
            }
          : layoutName === "breadthfirst"
          ? {
              name: "breadthfirst",
              directed: true,
              spacingFactor: 1,
              avoidOverlap: true,
              animate: true,
              direction: "rightward",
            }
          : layoutName === "circle"
              ? {
                  name: "circle",
                  animate: true,
                  fit: true,
                  padding: 24,
                }
              : layoutName === "concentric"
                ? {
                    name: "concentric",
                    animate: true,
                    fit: true,
                    padding: 24,
                  }
                : {
                    name: "grid",
                    avoidOverlap: true,
                    avoidOverlapPadding: 40,
                    spacingFactor: 1.5,
                    condense: false,
                    animate: true,
                    fit: true,
                    padding: 24,
                  };
      cy.layout(layoutOptions).run();
    }

    onClose();
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: "500px",
          minHeight: "400px",
          backgroundColor: colors.darkblue,
          borderRadius: 10,
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          // Use the theme's foreground token instead of literal white so the
          // modal stays readable on the soft-blue card background in light
          // mode (where colors.white resolves to a dark text color).
          color: colors.white,
          position: "relative",
        }}
      >
        <h2 style={{ margin: 0, textAlign: "center" }}>Graph Settings</h2>

        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            backgroundColor: "transparent",
            border: "none",
            fontSize: 18,
            fontWeight: 600,
            cursor: "pointer",
            color: colors.white,
          }}
        >
          ×
        </button>

        <NodeSettings
          neShape={neNodeShape}
          setNeShape={setNeNodeShape}
          lcaShape={lcaNodeShape}
          setLcaShape={setLcaNodeShape}
          neBorderStyle={neBorderStyle}
          setNeBorderStyle={setNeBorderStyle}
          lcaBorderStyle={lcaBorderStyle}
          setLcaBorderStyle={setLcaBorderStyle}
        />
        <EdgeSettings
          thickness={edgeThickness}
          setThickness={setEdgeThickness}
          arrowShape={arrowShape}
          setArrowShape={setArrowShape}
          neLineStyle={neLineStyle}
          setNeLineStyle={setNeLineStyle}
          lcaLineStyle={lcaLineStyle}
          setLcaLineStyle={setLcaLineStyle}
          neEdgeColor={neEdgeColor}
          setNeEdgeColor={setNeEdgeColor}
          lcaEdgeColor={lcaEdgeColor}
          setLcaEdgeColor={setLcaEdgeColor}
        />
        <LayoutSettings layoutName={layoutName} setLayoutName={setLayoutName} />

        <button
          onClick={handleSave}
          style={{
            marginTop: "auto",
            padding: "0.6rem",
            borderRadius: 6,
            border: "none",
            backgroundColor: colors.blue,
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}


