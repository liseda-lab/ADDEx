"use client";
import React, { useState } from "react";
import { useTheme } from "../../../../../styles/ThemeContext";
import { Triangle, Circle, Square, Minus } from "lucide-react";

interface EdgeSettingsProps {
  thickness: number;
  setThickness: (val: number) => void;
  arrowShape: string;
  setArrowShape: (val: string) => void;
  neLineStyle: string;
  setNeLineStyle: (val: string) => void;
  lcaLineStyle: string;
  setLcaLineStyle: (val: string) => void;
}

export default function EdgeSettings({
  thickness,
  setThickness,
  arrowShape,
  setArrowShape,
  neLineStyle,
  setNeLineStyle,
  lcaLineStyle,
  setLcaLineStyle,
}: EdgeSettingsProps) {
  const colors = useTheme();
  const [arrowOpen, setArrowOpen] = useState(false);
  const [neOpen, setNeOpen] = useState(false);
  const [lcaOpen, setLcaOpen] = useState(false);

  const arrowOptions = [
    { type: "triangle", icon: <Triangle size={20} /> },
    { type: "circle", icon: <Circle size={20} /> },
    { type: "square", icon: <Square size={20} /> },
  ];

  const lineOptions = [
    { type: "solid", icon: <Minus size={20} /> },
    { type: "dashed", icon: <Minus size={20} style={{ strokeDasharray: "4 2" }} /> },
    { type: "dotted", icon: <Minus size={20} style={{ strokeDasharray: "1 3" }} /> },
  ];

  const renderDropdown = (
    label: string,
    value: string,
    setValue: (val: string) => void,
    options: typeof arrowOptions,
    open: boolean,
    setOpen: (val: boolean) => void
  ) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span>{label}:</span>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setOpen(!open)}
            style={{
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #ccc",
              borderRadius: 4,
              backgroundColor: "white",
              cursor: "pointer",
            }}
          >
            {options.find((o) => o.type === value)?.icon &&
              React.cloneElement(options.find((o) => o.type === value)!.icon, { color: "black" })}
          </button>
          {open && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                width: 40,
                backgroundColor: "white",
                borderRadius: 4,
                border: "1px solid #ccc",
                marginTop: 4,
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {options.map((o) => (
                <div
                  key={o.type}
                  onClick={() => {
                    setValue(o.type);
                    setOpen(false);
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    backgroundColor: value === o.type ? "#e0f0ff" : "white",
                  }}
                >
                  {React.cloneElement(o.icon, { color: "black" })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

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
      <h4 style={{ margin: 0 }}>Edges</h4>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {/* Thickness */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>Thickness:</span>
          <input
            type="number"
            min={1}
            max={20}
            value={thickness}
            onChange={(e) => setThickness(Number(e.target.value))}
            style={{
              width: 60,
              padding: "4px 6px",
              borderRadius: 4,
              border: "1px solid #ccc",
            }}
          />
        </div>

        {/* Arrow */}
        {renderDropdown("Arrow", arrowShape, setArrowShape, arrowOptions, arrowOpen, setArrowOpen)}

        {/* NE Line */}
        {renderDropdown("NE", neLineStyle, setNeLineStyle, lineOptions, neOpen, setNeOpen)}

        {/* LCA Line */}
        {renderDropdown("LCA", lcaLineStyle, setLcaLineStyle, lineOptions, lcaOpen, setLcaOpen)}
      </div>
    </div>
  );
}