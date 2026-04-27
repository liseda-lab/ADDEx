"use client";
import React, { useState, useEffect } from "react";
import { Core } from "cytoscape";
import NodeSettings from "./NodeSettings";
import EdgeSettings from "./EdgeSettings";
import { getGraphSettings, setGraphSettings } from "@/app/hooks/graphSettings";
import { useTheme } from "../../../../../styles/ThemeContext";

interface EditGraphMenuProps {
  open: boolean;
  onClose: () => void;
  cy: Core | null;
}

export default function EditGraphMenu({ open, onClose, cy }: EditGraphMenuProps) {
  const colors = useTheme();
  const savedSettings = getGraphSettings();

  const [nodeShape, setNodeShape] = useState<string>(savedSettings.nodeShape);
  const [edgeThickness, setEdgeThickness] = useState<number>(savedSettings.edgeThickness);
  const [arrowShape, setArrowShape] = useState<string>(savedSettings.arrowShape);
  const [neLineStyle, setNeLineStyle] = useState<string>(savedSettings.neLineStyle);
  const [lcaLineStyle, setLcaLineStyle] = useState<string>(savedSettings.lcaLineStyle);

  // Sync current graph styles when menu opens
  useEffect(() => {
    if (!open || !cy) return;

    // Set node shape based on saved settings
    setNodeShape(savedSettings.nodeShape);
    setEdgeThickness(savedSettings.edgeThickness);
    setArrowShape(savedSettings.arrowShape);
    setNeLineStyle(savedSettings.neLineStyle);
    setLcaLineStyle(savedSettings.lcaLineStyle);
  }, [open]);

  const handleSave = () => {
    if (!cy) return;

    // Update node styles
    cy.nodes().forEach((node) => {
      void node.style("shape", nodeShape);
    });

    // Update edge styles
    cy.edges().forEach((edge) => {
      const type = edge.data("type");
      void edge.style("width", edgeThickness);
      void edge.style("target-arrow-shape", arrowShape);

      if (type === "LCA") {
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
      nodeShape,
      edgeThickness,
      arrowShape,
      neLineStyle,
      lcaLineStyle,
    });

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

        <NodeSettings selectedShape={nodeShape} setSelectedShape={setNodeShape} />
        <EdgeSettings
          thickness={edgeThickness}
          setThickness={setEdgeThickness}
          arrowShape={arrowShape}
          setArrowShape={setArrowShape}
          neLineStyle={neLineStyle}
          setNeLineStyle={setNeLineStyle}
          lcaLineStyle={lcaLineStyle}
          setLcaLineStyle={setLcaLineStyle}
        />

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