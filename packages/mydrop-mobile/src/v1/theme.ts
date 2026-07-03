import type { ItemType } from "@mydrop/core";

export const theme = {
  surface0: "#0d0f14",
  surface1: "#141820",
  surface2: "#1c2233",
  surface3: "#232b40",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  textPrimary: "#e8ecf5",
  textSecondary: "#8b95b0",
  textMuted: "#545e78",
  textAccent: "#7b9ef0",
  textSuccess: "#4ecb8d",
  textWarning: "#f0a840",
  textDanger: "#f06060",
  textPro: "#a07bf0",
  fillAccent: "#5b7fe0",
  fillSuccess: "#3dba7a",
  fillWarning: "#d4922a",
  bgAccent: "rgba(123,158,240,0.12)",
  bgSuccess: "rgba(78,203,141,0.12)",
  bgWarning: "rgba(240,168,64,0.12)",
  bgDanger: "rgba(240,96,96,0.12)",
  bgPro: "rgba(160,123,240,0.12)",
  borderAccent: "rgba(123,158,240,0.35)",
  borderSuccess: "rgba(78,203,141,0.35)",
  borderWarning: "rgba(240,168,64,0.35)",
  borderDanger: "rgba(240,96,96,0.35)",
  borderPro: "rgba(160,123,240,0.35)",
  onAccent: "#ffffff",
};

export const itemTypeColor: Record<ItemType, string> = {
  text: theme.textSuccess,
  link: theme.textAccent,
  file: theme.textPro,
  image: theme.textWarning,
  voice: theme.textDanger,
  clipboard: theme.textSecondary,
};

export const itemTypeBg: Record<ItemType, string> = {
  text: theme.bgSuccess,
  link: theme.bgAccent,
  file: theme.bgPro,
  image: theme.bgWarning,
  voice: theme.bgDanger,
  clipboard: theme.surface2,
};

export const itemTypeIcon: Record<ItemType, string> = {
  text: "📝",
  link: "🔗",
  file: "📄",
  image: "🖼",
  voice: "🎤",
  clipboard: "📋",
};
