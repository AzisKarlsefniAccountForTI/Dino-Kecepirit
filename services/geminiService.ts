
import { GameTheme } from "../types";

export const PRESET_THEMES: GameTheme[] = [
  {
    sky: "#f8fafc",
    ground: "#475569",
    dino: "#166534",
    cactus: "#064e3b",
    particle: "#b45309",
    themeName: "Pagi Kampus",
    icon: "☀️",
    gradient: "linear-gradient(to bottom, #bae6fd 0%, #f8fafc 100%)"
  },
  {
    sky: "#0f172a",
    ground: "#94a3b8",
    dino: "#4ade80",
    cactus: "#10b981",
    particle: "#334155",
    themeName: "Malam Lembur",
    icon: "🌙",
    gradient: "linear-gradient(to bottom, #020617 0%, #0f172a 100%)"
  },
  {
    sky: "#2e1065",
    ground: "#d946ef",
    dino: "#06b6d4",
    cactus: "#f43f5e",
    particle: "#fbbf24",
    themeName: "Cyberpunk IT",
    icon: "💻",
    gradient: "linear-gradient(to bottom, #2e1065 0%, #701a75 100%)"
  },
  {
    sky: "#fffbeb",
    ground: "#92400e",
    dino: "#b45309",
    cactus: "#166534",
    particle: "#d97706",
    themeName: "Gurun Pasir",
    icon: "🏜️",
    gradient: "linear-gradient(to bottom, #fbbf24 0%, #fffbeb 100%)"
  },
  {
    sky: "#f1f5f9",
    ground: "#1e293b",
    dino: "#2563eb",
    cactus: "#475569",
    particle: "#ffffff",
    themeName: "Musim Salju",
    icon: "❄️",
    gradient: "linear-gradient(to bottom, #e2e8f0 0%, #ffffff 100%)"
  },
  {
    sky: "#7c2d12",
    ground: "#451a03",
    dino: "#ea580c",
    cactus: "#1c1917",
    particle: "#f97316",
    themeName: "Senja IT",
    icon: "🌆",
    gradient: "linear-gradient(to bottom, #7c2d12 0%, #ea580c 60%, #fdba74 100%)"
  }
];

export function getNextTheme(currentThemeName: string): GameTheme {
  const currentIndex = PRESET_THEMES.findIndex(t => t.themeName === currentThemeName);
  const nextIndex = (currentIndex + 1) % PRESET_THEMES.length;
  return PRESET_THEMES[nextIndex];
}
