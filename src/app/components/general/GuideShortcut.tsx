"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass } from "phosphor-react";
import { useTheme, useThemeContext } from "../../../../styles/ThemeContext";

/**
 * Persistent floating shortcut to the Guide, visible on every page except
 * the Guide itself. Keeps "how do I use this?" one click away without
 * relying on the user spotting the Navbar tab.
 */
export default function GuideShortcut() {
  const colors = useTheme();
  const { theme } = useThemeContext();
  const pathname = usePathname();

  // Hide where the shortcut doesn't belong:
  //   - the Guide page itself (no point linking to current page)
  //   - the homepage (the hero already has a Guide CTA next to Start Exploring)
  //   - the Search page (overlaps the right-side verbalization panel)
  //   - the Software and About pages (they already have their own rich
  //     navigation; the floating pill is noise there).
  const hiddenOn = new Set([
    "/",
    "/pages/guide",
    "/pages/search",
    "/pages/software",
    "/pages/about",
  ]);
  if (hiddenOn.has(pathname)) return null;

  // Use the same meta-page accent as the Guide hero / About / Software so the
  // shortcut reads as "belongs to the Guide family" and pops against every
  // theme's page bg. Legacy keeps its OG teal-ish `fourthColor`. Dark uses
  // the darker saturated teal (index 11) instead of the vivid one (index 9),
  // which was eye-searing against the dark card background.
  const accent =
    theme === "legacy"
      ? colors.fourthColor
      : theme === "light"
        ? colors.headingAccents[11]
        : theme === "dark"
          ? colors.headingAccents[11]
          : colors.headingAccents[9];

  return (
    <Link
      href="/pages/guide"
      aria-label="Open the ADDEx Guide for instructions"
      style={{
        position: "fixed",
        bottom: "1.75rem",
        right: "1.75rem",
        zIndex: 40,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.55rem",
        padding: "0.95rem 1.5rem",
        borderRadius: 999,
        background: accent,
        color: "#FFFFFF",
        fontSize: "0.98rem",
        fontWeight: 700,
        letterSpacing: "0.01em",
        textDecoration: "none",
        // Gentle accent-tinted glow so the shortcut reads as a CTA without
        // being a floodlight — the earlier three-layer glow was too bright
        // in dark mode.
        boxShadow: `0 10px 24px rgba(0,0,0,0.35), 0 0 0 1px ${accent}66`,
        transition:
          "opacity 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "0.92";
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = `0 12px 28px rgba(0,0,0,0.4), 0 0 0 2px ${accent}88`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "1";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = `0 10px 24px rgba(0,0,0,0.35), 0 0 0 1px ${accent}66`;
      }}
    >
      <Compass size={20} weight="bold" aria-hidden="true" />
      Guide
    </Link>
  );
}
