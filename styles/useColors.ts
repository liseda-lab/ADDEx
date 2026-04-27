import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import colors from "./colors";
import { nodeColors as ALL_PALETTES, type TypeColorMap } from "./typeColors";
import { normalizeNodeType } from "./typeKey";
import { useThemeContext } from "./ThemeContext";
import type { ThemeName } from "./themes";

const pastelPalette = colors.pastel;
// v2: namespaced after the per-theme palette refactor. Old `graphNodeColorsSession`
// entries from the single-palette era would otherwise reload as user overrides
// and pin every theme's defaults to the same (legacy-era) values.
const SESSION_STORAGE_KEY = "graphNodeColorsSession_v2";
const PALETTE_OVERRIDE_KEY = "graphNodeColorsPalette_v2";

type PaletteMap = TypeColorMap;

function buildDefaults(paletteName: ThemeName): PaletteMap {
  const source = ALL_PALETTES[paletteName] ?? ALL_PALETTES.legacy;
  return Object.entries(source).reduce<PaletteMap>((acc, [type, color]) => {
    const normalized = normalizeNodeType(type);
    if (normalized) acc[normalized] = color;
    return acc;
  }, {});
}

function isValidHex(color: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

function readUserOverrides(): PaletteMap {
  if (typeof window === "undefined") return {};
  const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: PaletteMap = {};
    Object.entries(parsed).forEach(([type, value]) => {
      if (typeof value === "string" && isValidHex(value)) {
        const normalized = normalizeNodeType(type);
        if (normalized) result[normalized] = value;
      }
    });
    return result;
  } catch {
    return {};
  }
}

function writeUserOverrides(overrides: PaletteMap) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(overrides));
}

function readPaletteOverride(): ThemeName | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(PALETTE_OVERRIDE_KEY);
  if (!raw) return null;
  if (
    raw === "legacy" ||
    raw === "light" ||
    raw === "dark" ||
    raw === "highContrast" ||
    raw === "colorBlind"
  ) {
    return raw;
  }
  return null;
}

function writePaletteOverride(value: ThemeName | null) {
  if (typeof window === "undefined") return;
  if (value) {
    window.sessionStorage.setItem(PALETTE_OVERRIDE_KEY, value);
  } else {
    window.sessionStorage.removeItem(PALETTE_OVERRIDE_KEY);
  }
}

export function useColors() {
  const { theme } = useThemeContext();
  const [paletteOverride, setPaletteOverrideState] = useState<ThemeName | null>(
    null
  );
  const userOverridesRef = useRef<PaletteMap>({});

  // The visualization palette follows the active app theme by default. Users
  // can pin a specific palette (e.g., view dark theme but keep light-mode
  // pastels) via setPaletteOverride; that pin is persisted in sessionStorage.
  const effectivePalette: ThemeName = paletteOverride ?? theme;

  const defaultNodeColors = useMemo(
    () => buildDefaults(effectivePalette),
    [effectivePalette]
  );

  const [nodeTypeColors, setNodeTypeColors] = useState<PaletteMap>(() =>
    buildDefaults(effectivePalette)
  );
  const [persona] = useState<{ id: string }>({ id: "neutral" });
  const usedColorsRef = useRef<Set<string>>(new Set());

  const getUnusedPastelColor = useCallback(() => {
    const unused = pastelPalette.filter((c) => !usedColorsRef.current.has(c));
    const selected =
      unused.length > 0
        ? unused[0]
        : `#${Math.floor(Math.random() * 16777215)
            .toString(16)
            .padStart(6, "0")}`;
    usedColorsRef.current.add(selected);
    return selected;
  }, []);

  // Hydrate from sessionStorage once on mount: load saved override-palette
  // pin, then load any per-type user overrides on top of the palette defaults.
  useEffect(() => {
    userOverridesRef.current = readUserOverrides();
    const savedPalette = readPaletteOverride();
    if (savedPalette) setPaletteOverrideState(savedPalette);
  }, []);

  // Whenever the effective palette changes (theme change, or user pins a
  // different palette), rebuild the color map: start from the palette's
  // defaults, then apply user overrides on top so customizations survive.
  useEffect(() => {
    const defaults = buildDefaults(effectivePalette);
    const overrides = userOverridesRef.current;
    const next = { ...defaults, ...overrides };
    setNodeTypeColors(next);

    const newUsed = new Set<string>();
    Object.values(next).forEach((c) => {
      if (isValidHex(c)) newUsed.add(c);
    });
    usedColorsRef.current = newUsed;
  }, [effectivePalette]);

  const ensureColors = useCallback(
    (types: string[]) => {
      setNodeTypeColors((prev) => {
        const filtered = types
          .map(normalizeNodeType)
          .filter((t) => t && t !== "ne");
        const missing = filtered.filter((t) => !prev[t]);
        if (missing.length === 0) return prev;

        const additions: PaletteMap = {};
        missing.forEach((t) => {
          if (t === "lca") {
            additions[t] = defaultNodeColors[t] || "#999999";
          } else {
            additions[t] = defaultNodeColors[t] || getUnusedPastelColor();
          }
        });

        return { ...prev, ...additions };
      });
    },
    [defaultNodeColors, getUnusedPastelColor]
  );

  const updateColor = useCallback((type: string, color: string) => {
    const normalized = normalizeNodeType(type);
    if (!isValidHex(color) || normalized === "ne" || !normalized) {
      return;
    }
    userOverridesRef.current = {
      ...userOverridesRef.current,
      [normalized]: color,
    };
    writeUserOverrides(userOverridesRef.current);
    setNodeTypeColors((prev) => ({ ...prev, [normalized]: color }));
    usedColorsRef.current.add(color);
  }, []);

  const resetColors = useCallback(() => {
    userOverridesRef.current = {};
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    const defaults = buildDefaults(effectivePalette);
    setNodeTypeColors(defaults);
    usedColorsRef.current = new Set(
      Object.values(defaults).filter(isValidHex)
    );
  }, [effectivePalette]);

  const setPaletteOverride = useCallback((next: ThemeName | null) => {
    setPaletteOverrideState(next);
    writePaletteOverride(next);
  }, []);

  return {
    nodeTypeColors,
    getColorForType: (type: string) =>
      nodeTypeColors[normalizeNodeType(type)] || "#ffffff",
    updateColor,
    ensureColors,
    persona,
    resetColors,
    paletteName: effectivePalette,
    paletteOverride,
    setPaletteOverride,
  };
}
