/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Jetons M3ak : mêmes valeurs que src/constants/theme.ts (M3akPalette).
        brand: { DEFAULT: '#9438D8', deep: '#321943', light: '#F3E7FC', soft: '#F7EEFD' },
        primary: { DEFAULT: '#9438D8', pressed: '#7E2BBE' },
        'on-primary': '#FFFFFF',
        lavender: '#CB83F5',
        line: { DEFAULT: '#EADCF5', soft: '#F3E9FA' },
        canvas: '#F8F3FC',
        ink: '#171126',
        subtle: '#9686AE',
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
