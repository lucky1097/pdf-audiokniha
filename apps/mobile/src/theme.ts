// The app's tokens from DESIGN.md: system type, one orange accent, light and dark.
import { useColorScheme } from "react-native";

const light = {
  bg: "#ffffff",
  surface: "#f4f5f7",
  raised: "#ffffff",
  ink: "#111827",
  ink2: "#4b5563",
  line: "#e5e7eb",
  accent: "#c2410c",
  accentSoft: "#ffedd5",
  accentText: "#c2410c",
  onAccent: "#ffffff",
  warn: "#92400e",
  warnSoft: "#fef3c7",
  error: "#b91c1c",
  ok: "#15803d",
};

const dark: typeof light = {
  bg: "#0f1115",
  surface: "#161920",
  raised: "#1c2028",
  ink: "#f3f4f6",
  ink2: "#a3a9b6",
  line: "#2a2f3a",
  accent: "#fb923c",
  accentSoft: "#3a2414",
  accentText: "#fdba74",
  onAccent: "#1a0e05",
  warn: "#fbbf24",
  warnSoft: "#3a2c0e",
  error: "#f87171",
  ok: "#4ade80",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

/** Generated cover colour, the same hash and range as the web (clear of the accent's orange). */
export function coverColor(title: string): string {
  let h = 0x811c9dc5;
  for (const c of title) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return `hsl(${65 + (h % 280)}, 45%, 30%)`;
}
