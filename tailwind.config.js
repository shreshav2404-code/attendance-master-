const { hairlineWidth } = require("nativewind/theme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#0f2d55",
        secondary: "#1a5fa8",
        success: "#059669",
        warning: "#f59e0b",
        danger: "#dc2626",
        exact: "#0369a1",
        projected: "#7c3aed",
        background: "#0a0f1e",
        surface: "#111827",
        border: "#1f2937",
        muted: "#94a3b8",
        text: "#f8fafc",
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      fontFamily: {
        inter: ["Inter_400Regular"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
        "inter-bold": ["Inter_700Bold"],
      },
      boxShadow: {
        glow: "0 0 30px rgba(26,95,168,0.35)",
      },
    },
  },
};
