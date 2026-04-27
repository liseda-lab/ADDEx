"use client";

import { useState, useRef, useEffect } from "react";
import { Palette as PaletteIcon } from "lucide-react";
import { CaretDown } from "phosphor-react";
import { useThemeContext } from "../../../../styles/ThemeContext";
import type { ThemeName } from "../../../../styles/themes";

const THEME_OPTIONS: { value: ThemeName; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "legacy", label: "Legacy" },
  { value: "highContrast", label: "High contrast" },
];

export default function ThemeToggle() {
  const { theme, palette, setTheme } = useThemeContext();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const clickHandler = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", clickHandler);
    window.addEventListener("keydown", keyHandler);
    return () => {
      window.removeEventListener("mousedown", clickHandler);
      window.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  const currentLabel =
    THEME_OPTIONS.find((o) => o.value === theme)?.label ?? "Theme";

  const menuBg =
    theme === "dark"
      ? "#2A2A2A"
      : theme === "light"
        ? palette.card
        : theme === "highContrast"
          ? palette.black
          : palette.darkblue;

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="addex-nav-tab"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Theme: ${currentLabel}. Click to change.`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="theme-menu"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.45rem",
          padding: "0.45rem 0.9rem",
          borderRadius: 6,
          border: "none",
          backgroundColor: "transparent",
          color: palette.white,
          fontWeight: 500,
          fontSize: "0.875rem",
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "background-color 0.15s",
          minWidth: 120,
          boxSizing: "border-box",
        }}
      >
        <PaletteIcon size={16} aria-hidden="true" />
        Theme
        <CaretDown
          size={12}
          weight="bold"
          color={palette.white}
          aria-hidden="true"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        />
      </button>
      {open && (
        <div
          id="theme-menu"
          role="menu"
          aria-label="Select theme"
          style={{
            position: "absolute",
            top: "calc(100% + 0.35rem)",
            right: 0,
            minWidth: 200,
            background: menuBg,
            border: `1px solid ${palette.grayDark}`,
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
            padding: "0.35rem",
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {THEME_OPTIONS.map((option) => {
            const active = option.value === theme;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(option.value);
                  setOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background =
                      "color-mix(in srgb, currentColor 14%, transparent)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  textAlign: "left",
                  borderRadius: 8,
                  border: "none",
                  background: active
                    ? "color-mix(in srgb, currentColor 14%, transparent)"
                    : "transparent",
                  color: palette.white,
                  fontSize: "0.88rem",
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
