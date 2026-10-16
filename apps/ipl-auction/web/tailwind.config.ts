import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        franchise: {
          csk: "#f9cd05",
          mi: "#004ba0",
          rcb: "#d71920",
          kkr: "#3a225d",
          srh: "#f26522",
          dc: "#0078bc",
          rr: "#ea1a85",
          gt: "#1c2c5b",
          lsg: "#a72056",
          pbks: "#dd1f2d",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "pulse-fast": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        "bid-flash": {
          "0%": { transform: "scale(1)", backgroundColor: "rgba(59, 130, 246, 0.2)" },
          "50%": { transform: "scale(1.02)", backgroundColor: "rgba(59, 130, 246, 0.4)" },
          "100%": { transform: "scale(1)", backgroundColor: "transparent" },
        },
      },
      animation: {
        "pulse-fast": "pulse-fast 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bid-flash": "bid-flash 0.5s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
