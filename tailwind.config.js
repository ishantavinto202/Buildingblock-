/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        satoshi: ["satoshi_medium"],
      },
      boxShadow: {
        buttonShadow: "0 2px 8px 0px rgba(0,0,0,0.33)",
      },
      colors: {
        primary: "var(--primary)",
        primaryDark: "var(--primaryDark)",
        primaryForeground: "var(--primaryForeground)",
        mutedForeground: "var(--mutedForeground)",
        secondary: "var(--secondary)",
        secondaryForeground: "var(--secondaryForeground)",
        secondaryDark: "var(--secondaryDark)",
        bottomSheet: "var(--bottomSheet)",
        red: "var(--red)",
        heartRed: "var(--heartRed)",
        yellow: "var(--yellow)",
        input: "var(--input)",
        border: "var(--border)",
        green: "var(--green)",
        channelBorder: "var(--channelBorder)",
        listenGradient: "var(--listenGradient)",
        nearInvisible: "var(--nearInvisible)",
      },
    },
  },
  plugins: [],
};
