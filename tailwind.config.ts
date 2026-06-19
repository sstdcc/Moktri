import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        tajawal: ['"IBM Plex Sans Arabic"', "Tajawal", "sans-serif"],
        cairo: ['"IBM Plex Sans Arabic"', "Cairo", "Tajawal", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          foreground: "hsl(var(--danger-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "page-enter": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "card-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "heart-pop": {
          "0%": { transform: "scale(1)" },
          "30%": { transform: "scale(0.8)" },
          "60%": { transform: "scale(1.25)" },
          "100%": { transform: "scale(1)" },
        },
        "overlay-show": {
          "0%": { opacity: "0", backdropFilter: "blur(0px)" },
          "100%": { opacity: "1", backdropFilter: "blur(6px)" },
        },
        "overlay-hide": {
          "0%": { opacity: "1", backdropFilter: "blur(6px)" },
          "100%": { opacity: "0", backdropFilter: "blur(0px)" },
        },
        "sheet-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "sheet-down": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(100%)" },
        },
        "dialog-in": {
          "0%": { opacity: "0", transform: "translate(-50%, -50%) scale(0.96)" },
          "100%": { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        "dialog-out": {
          "0%": { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
          "100%": { opacity: "0", transform: "translate(-50%, -50%) scale(0.97)" },
        },
        "attention-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--destructive) / 0.0)" },
          "50%": { boxShadow: "0 0 0 6px hsl(var(--destructive) / 0.15)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(-8px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "success-ring": {
          "0%": { transform: "scale(0.4)", opacity: "0" },
          "60%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "check-draw": {
          "0%": { strokeDashoffset: "24" },
          "100%": { strokeDashoffset: "0" },
        },
        "badge-pop": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "60%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "badge-out": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(0)", opacity: "0" },
        },
        "nav-icon-pop": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(0.88)" },
          "100%": { transform: "scale(1)" },
        },
        "nav-dot-in": {
          "0%": { transform: "translateX(-50%) scale(0)", opacity: "0" },
          "100%": { transform: "translateX(-50%) scale(1)", opacity: "1" },
        },
        "nav-accent-in": {
          "0%": { transform: "translateY(-50%) scaleY(0.2)", opacity: "0" },
          "100%": { transform: "translateY(-50%) scaleY(1)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "page-enter": "page-enter 260ms cubic-bezier(0.22, 1, 0.36, 1)",
        "card-in": "card-in 380ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "heart-pop": "heart-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        "overlay-show": "overlay-show 280ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "overlay-hide": "overlay-hide 220ms cubic-bezier(0.4, 0, 1, 1) both",
        "sheet-up": "sheet-up 420ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "sheet-down": "sheet-down 300ms cubic-bezier(0.4, 0, 1, 1) both",
        "dialog-in": "dialog-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "dialog-out": "dialog-out 180ms cubic-bezier(0.4, 0, 1, 1) both",
        "attention-pulse": "attention-pulse 1.8s ease-in-out infinite",
        "toast-in": "toast-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "success-ring": "success-ring 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "check-draw": "check-draw 380ms 180ms cubic-bezier(0.65, 0, 0.35, 1) both",
        "badge-pop": "badge-pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "badge-out": "badge-out 180ms cubic-bezier(0.4, 0, 1, 1) both",
        "nav-icon-pop": "nav-icon-pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        "nav-dot-in": "nav-dot-in 260ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "nav-accent-in": "nav-accent-in 260ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
