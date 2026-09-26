/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: "#06080d",
        surface: "#0d131f",
        neonCyan: "#06b6d4",
        neonEmerald: "#10b981",
        alertRed: "#f43f5e",
        warningAmber: "#f59e0b",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace', 'Consolas'],
      }
    },
  },
  plugins: [],
}