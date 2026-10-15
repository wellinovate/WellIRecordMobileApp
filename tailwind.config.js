/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.js",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        welli: {
          navy: "#082F67",
          blue: "#0B3268",
          text: "#173B68",
          muted: "#64748B",
        },
      },
      fontSize: {
        "auth-display": ["28px", { lineHeight: "34px" }],
        "auth-title": ["24px", { lineHeight: "30px" }],
        "auth-subtitle": ["14px", { lineHeight: "20px" }],
        "auth-body": ["13px", { lineHeight: "19px" }],
        "auth-label": ["12px", { lineHeight: "16px" }],
        "auth-input": ["14px", { lineHeight: "20px" }],
        "auth-helper": ["11.5px", { lineHeight: "16px" }],
      },
    },
  },
  plugins: [],
};