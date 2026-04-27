"use client";
import React, { JSX, useState } from "react";
import { Circle, Hexagon, Square, Diamond, Triangle, Octagon } from "lucide-react";
import { useTheme } from "../../../../../styles/ThemeContext";

interface NodeSettingsProps {
  selectedShape: string;
  setSelectedShape: (shape: string) => void;
}

export default function NodeSettings({ selectedShape, setSelectedShape }: NodeSettingsProps) {
  const colors = useTheme();
  const [openDropdown, setOpenDropdown] = useState(false);
  // Match EdgeSettings: dropdown chrome stays white-on-black regardless of
  // theme so the controls read consistently across light/dark/legacy.
  const buttonBg = "white";
  const iconColor = "black";

  const shapes: { type: string; icon: JSX.Element }[] = [
    { type: "diamond", icon: <Diamond size={20} /> },
    { type: "ellipse", icon: <Circle size={20} /> },
    { type: "hexagon", icon: <Hexagon size={20} /> },
    { type: "octagon", icon: <Octagon size={20} /> },
    { type: "roundrectangle", icon: <Square size={20} /> }, // Cytoscape rectangle
    { type: "triangle", icon: <Triangle size={20} /> },
  ];

  // Ensure default selected shape shows rectangle
  const selectedShapeObj =
    shapes.find((s) => s.type === selectedShape) ||
    shapes.find((s) => s.type === "roundrectangle");

  return (
    <div
      style={{
        border: `1px solid ${colors.white}30`,
        borderRadius: 10,
        padding: "1rem",
        backgroundColor: colors.darkblue,
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <h4 style={{ margin: 0 }}>Nodes</h4>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span>Shape:</span>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setOpenDropdown(!openDropdown)}
            style={{
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #ccc",
              borderRadius: 4,
              backgroundColor: buttonBg,
              cursor: "pointer",
              padding: 0,
            }}
          >
            {selectedShapeObj && React.cloneElement(selectedShapeObj.icon, { color: iconColor, size: 20 })}
          </button>

          {openDropdown && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                backgroundColor: buttonBg,
                borderRadius: 4,
                border: "1px solid #ccc",
                marginTop: 4,
                overflow: "hidden",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {shapes.map((shape) => (
                <div
                  key={shape.type}
                  onClick={() => {
                    setSelectedShape(shape.type);
                    setOpenDropdown(false);
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    backgroundColor: selectedShape === shape.type ? "#e0f0ff" : buttonBg,
                  }}
                >
                  {React.cloneElement(shape.icon, { color: iconColor, size: 20 })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
