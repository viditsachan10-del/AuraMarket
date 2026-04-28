import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#060608",
        primary: "#FFFFFF",
        aura: {
          DEFAULT: "#E8A87C",
          light: "#F4C842",
          dark: "#C5895B",
        },
        bg: {
          surface: "#0C0D14",
          card: "rgba(255, 255, 255, 0.03)",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#A0A0B0",
          accent: "#E8A87C",
        },
        border: {
          aura: "rgba(232, 168, 124, 0.15)",
          glass: "rgba(255, 255, 255, 0.06)",
        }
      },
      fontFamily: {
        serif: ["Cormorant Garamond", "serif"],
        sans: ["DM Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        fadeIn: "fadeIn 0.8s ease-out forwards",
        fadeInUp: "fadeInUp 1s ease-out forwards",
        fadeInDown: "fadeInDown 0.6s ease-out forwards",
        fadeInLeft: "fadeInLeft 0.8s ease-out forwards",
        float: "float 6s ease-in-out infinite",
        pulse: "pulse 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          "0%": { opacity: "0", transform: "translateY(-20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInLeft: {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
      },
      backgroundImage: {
        "aura-gradient": "linear-gradient(135deg, #E8A87C 0%, #F4C842 100%)",
        "dark-gradient": "radial-gradient(circle at top right, #0C0D14 0%, #060608 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
