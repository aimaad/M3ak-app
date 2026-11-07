/** @type {import('tailwindcss').Config} */
const { BRAND } = require('./src/constants/brand');

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Jetons BIBIP : mêmes valeurs que src/constants/brand.js (source de vérité unique).
        brand: { DEFAULT: BRAND.primary, deep: BRAND.primaryDeep, light: BRAND.primaryLight, soft: BRAND.primarySoft },
        primary: { DEFAULT: BRAND.primary, pressed: BRAND.primaryPressed },
        'on-primary': BRAND.onPrimary,
        mint: BRAND.mint,
        lime: BRAND.lime,
        line: { DEFAULT: BRAND.border, soft: BRAND.borderSoft },
        canvas: BRAND.background,
        ink: BRAND.ink,
        subtle: BRAND.subtle,
      },
      fontFamily: {
        cairo: ['Cairo_400Regular'],
        'cairo-medium': ['Cairo_500Medium'],
        'cairo-semibold': ['Cairo_600SemiBold'],
        'cairo-bold': ['Cairo_700Bold'],
      },
    },
  },
  plugins: [],
};
