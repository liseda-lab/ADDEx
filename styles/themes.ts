export type ThemeName =
  | "legacy"
  | "dark"
  | "light"
  | "highContrast"
  | "colorBlind";

export interface Palette {
  firstColor: string;
  secondColor: string;
  thirdColor: string;
  fourthColor: string;
  buttons: string;
  card: string;
  darkblue: string;
  green: string;
  blue: string;
  black: string;
  white: string;
  teal: string;
  gray: string;
  grayDark: string;
  background: string;
  pastel: string[];
  animatedColors: string[];
  // Strong saturated/deep accent tones meant for headings, section titles,
  // and card borders — always legible against the theme's card surface.
  // Separate from `animatedColors` (which is tuned for ambient bg motion).
  headingAccents: string[];
}

export const legacyPalette: Palette = {
  firstColor: "#3366CC",
  secondColor: "#4C5BD4",
  thirdColor: "#66CC33",
  fourthColor: "#57C9C5",
  // OG legacy buttons were `colors.firstColor` (blue) with white text —
  // keep `buttons` pointing at the same blue so primary buttons in legacy
  // render identically to the OG implementation.
  buttons: "#3366CC",
  card: "#050F28",
  darkblue: "#1E2A47",
  green: "#66CC33",
  blue: "#3366CC",
  black: "#000000",
  white: "#FFFFFF",
  teal: "#57C9C5",
  gray: "#6B7A8F",
  grayDark: "#666666",
  // OG legacy page backdrop was white (`colors.white` in OG colors.ts).
  // Must stay white so the animated dots render against the same backdrop
  // they did in the original implementation.
  background: "#FFFFFF",
  pastel: [
    "#E8C3D3", "#F6D6AD", "#F9E27D", "#CFE8A9", "#AEE5C8",
    "#BFE9E3", "#A9D6F5", "#C7CEFF", "#D9C2F0", "#F4C7E7",
    "#F7C7B6", "#D6E6B8", "#B8E0D2", "#C9D9F7", "#EAD7B8",
  ],
  animatedColors: [
    "#4C5BD4", "#6F7BE3", "#3A46A8",
    "#3366CC", "#5C85D6", "#1E2A47",
    "#57C9C5", "#8FDCDC", "#3FA3A0",
    "#66CC33", "#85E066", "#4C9926",
  ],
  headingAccents: [
    "#4C5BD4", "#6F7BE3", "#3A46A8",
    "#3366CC", "#5C85D6", "#1E2A47",
    "#57C9C5", "#8FDCDC", "#3FA3A0",
    "#66CC33", "#85E066", "#4C9926",
  ],
};

// Dark theme: Overleaf-style flat grey background + GigaScience-paper pastel accents.
// All accents are low-saturation pastels sampled from the paper figures (sage green,
// soft blue, lavender, peach, mint, rose) — no jewel-tone blue/green/purple.
export const darkPalette: Palette = {
  firstColor: "#A8C8B0",   // GigaScience sage green (logo/section headings)
  secondColor: "#C5B5D5",  // paper soft lavender
  thirdColor: "#B8D5A8",   // paper mint/pastel green
  fourthColor: "#A8CEC8",  // paper muted teal
  buttons: "#1F7A70",      // dark teal — harmonizes with the teal accent
                           // family (headingAccents[9..11]) instead of the
                           // old saturated blue, which fought the Guide /
                           // About / Software teal highlights. White text
                           // keeps AA contrast.
  card: "#555555",         // lifted card surface — sits clearly above the page
  darkblue: "#666666",     // repurposed: neutral grey accent, not navy
  green: "#A8C8B0",        // sage green (paper-matched)
  blue: "#B5CDD8",         // paper soft blue
  black: "#1A1A1A",
  white: "#F0F0F0",        // "foreground" / primary text; not pure white
  teal: "#A8CEC8",
  gray: "#B8B8B8",
  grayDark: "#8A8A8A",
  background: "#3A3A3A",   // lighter page background (was #2B2B2B) — feels airier
  pastel: [
    "#E8B8B8", "#E8C8A0", "#F0E5A8", "#C8DCA8", "#A8C8A8",
    "#A8CEC8", "#B5CDD8", "#C5B5D5", "#D5B8D0", "#E8B8CC",
    "#E8C0AC", "#D0DCA8", "#B8D5C0", "#B8C5D8", "#E5D8A8",
  ],
  // Dark theme: lighter pastel moving animation so dots read as airy motion
  // over the #2B2B2B page rather than disappearing into the background.
  animatedColors: [
    "#9DB8C8", "#B5CDD8", "#7F94A3",   // soft blue
    "#B5A5CD", "#C8B8E0", "#9080A8",   // lavender
    "#A8CEC8", "#C0DCD5", "#8AB0A8",   // teal
    "#A8C8B0", "#BCDCC5", "#8AB098",   // sage
  ],
  // Saturated accents tuned for the #4A4A4A dark card — pushed toward higher
  // chroma than the airy pastels so titles/borders read as vivid, not washed.
  headingAccents: [
    "#B588FF", "#CFAAFF", "#9A66F0",   // saturated purple
    "#5AB0FF", "#85C8FF", "#2E95F0",   // saturated sky blue
    "#5FE895", "#8FF0B0", "#36CC70",   // saturated mint / green
    "#45E0CA", "#75ECDC", "#1FC8B5",   // saturated teal
  ],
};

// Light theme — soft, airy pastel UI for a bright backdrop. Gets the
// "white" moving animation (light pastel dots) to feel gentle and subtle.
export const lightPalette: Palette = {
  firstColor: "#7FA889",   // sage accent (paper-matched)
  secondColor: "#A898C0",  // soft lavender accent
  thirdColor: "#8FB88F",   // muted pastel green
  fourthColor: "#8EB8B0",  // soft teal
  buttons: "#4A5562",      // neutral slate gray — reads with white text at AA
  card: "#FFFFFF",
  darkblue: "#C8D4E8",     // soft pastel blue (active-tab highlight, etc.)
  green: "#7FA889",
  blue: "#8FA8C5",
  black: "#0F1420",
  white: "#1F2433",       // text-on-light
  teal: "#8EB8B0",
  gray: "#5F6B80",
  grayDark: "#2F3544",
  background: "#F5F6FA",
  pastel: [
    "#E8B8B8", "#E8C8A0", "#F0E5A8", "#C8DCA8", "#A8C8A8",
    "#A8CEC8", "#B5CDD8", "#C5B5D5", "#D5B8D0", "#E8B8CC",
    "#E8C0AC", "#D0DCA8", "#B8D5C0", "#B8C5D8", "#E5D8A8",
  ],
  // Light theme gets the airy pastel "white" moving animation.
  animatedColors: [
    "#C5B5D5", "#D8C8E0", "#B0A5C0",   // pastel lavender
    "#B5CDD8", "#CDDCE5", "#A8BCC8",   // pastel blue
    "#A8CEC8", "#C0DCD5", "#98BCB0",   // pastel teal
    "#A8C8B0", "#C8DCC0", "#98B8A0",   // pastel sage
  ],
  // Vivid saturated accents — alive and punchy on white cards, not muted
  // or forest-toned. Each hue keeps enough depth to stay readable.
  headingAccents: [
    "#8A3DD9", "#A05FE8", "#6B2EB8",   // vivid purple
    "#2E7AD9", "#4F95E8", "#1F5FB5",   // vivid blue
    "#1F9F8A", "#3FB5A0", "#147F6E",   // vivid teal
    "#3AAB55", "#5FC47A", "#258C3E",   // vivid green
  ],
};

// High-contrast accessibility theme: optimized for low-vision users and
// color-blindness (deuteranopia, protanopia, tritanopia). Accent hues are
// drawn from the Okabe–Ito palette — the de-facto color-blind-safe palette
// validated by the visualization community — with WCAG-AAA contrast against
// a near-black background.
export const highContrastPalette: Palette = {
  firstColor: "#56B4E9",   // sky blue (Okabe–Ito)
  secondColor: "#CC79A7",  // reddish purple (Okabe–Ito)
  thirdColor: "#009E73",   // bluish green (Okabe–Ito)
  fourthColor: "#0072B2",  // blue (Okabe–Ito)
  buttons: "#0072B2",      // Okabe–Ito blue — strong contrast with white text
  card: "#111111",
  darkblue: "#0072B2",
  green: "#009E73",
  blue: "#56B4E9",
  black: "#000000",
  white: "#FFFFFF",
  teal: "#56B4E9",
  gray: "#D0D0D0",
  grayDark: "#909090",
  background: "#000000",
  pastel: [
    "#E69F00", // orange
    "#56B4E9", // sky blue
    "#009E73", // bluish green
    "#F0E442", // yellow
    "#0072B2", // blue
    "#D55E00", // vermillion
    "#CC79A7", // reddish purple
    "#FFFFFF", // white
    "#E69F00",
    "#56B4E9",
    "#009E73",
    "#F0E442",
    "#0072B2",
    "#D55E00",
    "#CC79A7",
  ],
  animatedColors: [
    "#E69F00", "#F5C04A", "#B37A00",
    "#56B4E9", "#88CAF0", "#1F85C4",
    "#009E73", "#3FC79A", "#00714F",
    "#CC79A7", "#E0A3C3", "#994F7A",
  ],
  headingAccents: [
    "#E69F00", "#F5C04A", "#B37A00",
    "#56B4E9", "#88CAF0", "#1F85C4",
    "#009E73", "#3FC79A", "#00714F",
    "#CC79A7", "#E0A3C3", "#994F7A",
  ],
};

// Color-blind-safe graph palette: a deuteranopia/protanopia/tritanopia-friendly
// option intended primarily as a graph-palette override (selectable in the
// visualizer's palette dropdown) rather than as a full UI theme. Hues are
// drawn from the Okabe–Ito 8-color set, the de-facto CVD-safe palette in the
// visualization community, but at moderate saturation so the figures still
// match the soft pastel aesthetic of the other palettes. The surrounding UI
// chrome inherits from the light palette for a familiar surface.
export const colorBlindPalette: Palette = {
  ...lightPalette,
  // Accent colors retuned to Okabe–Ito so any UI surface that does pick up
  // this palette (e.g. accidentally activating it as a theme) stays
  // CVD-distinguishable instead of falling back to the soft pastels of light.
  firstColor: "#009E73",   // bluish green
  secondColor: "#CC79A7",  // reddish purple
  thirdColor: "#56B4E9",   // sky blue
  fourthColor: "#E69F00",  // orange
  green: "#009E73",
  blue: "#0072B2",
  teal: "#56B4E9",
};

export const themes: Record<ThemeName, Palette> = {
  legacy: legacyPalette,
  dark: darkPalette,
  light: lightPalette,
  highContrast: highContrastPalette,
  colorBlind: colorBlindPalette,
};
