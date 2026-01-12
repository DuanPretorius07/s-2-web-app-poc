/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        's2': {
          'red': '#8B1538',        // Primary dark red/maroon (from S-2 International branding)
          'red-dark': '#6B0F2A',   // Darker red for hover states
          'red-light': '#A91E48',  // Lighter red for accents
          'red-lighter': '#F5E6EB', // Very light red for backgrounds
          'navy': '#003366',       // Secondary dark blue (logo border, footer)
          'blue': '#0066CC',       // Secondary blue
          'gray-light': '#F5F7FA', // Light gray background
        },
      },
    },
  },
  plugins: [],
}
