/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lightblue: "#B0D0D3",
        puce: "#C08497",
        melon: "#F7AF9D",
        peach: "#F7E3AF",
        lemon: "#F3EEC3",
      },
    },
  },
  plugins: [],
};



/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{js,jsx,ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
