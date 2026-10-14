/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['variant', ['&:is(.dark *):not(:is(.dark .light *))']],
  theme: {
    extend: {
      colors: {
        brand: 'rgb(14,140,110)', // Krao green #0E8C6E
        brandHover: 'rgb(240,250,246)',
        brandHoverDark: 'rgb(16,30,26)',
        brandLighten: 'rgb(23,168,134)', // #17A886
        textLight: 'rgb(63,82,104)',
        textDimmed: 'rgb(164,179,197)',
        textNeutral: 'rgb(102,123,153)',
        dimmedBgLighten: 'rgb(30,41,54)',
        dimmedBg: 'rgb(22,30,39)',
        dimmedBgDarken: 'rgb(18,25,32)',
      },
    },
  },
  plugins: [],
}
