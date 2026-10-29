/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Jetons Kriha : mêmes valeurs que src/constants/theme.ts (M3akPalette).
        brand: { DEFAULT: '#007A59', deep: '#064E3B', light: '#E3F5EE', soft: '#EEF7F3' },
        emerald: { DEFAULT: '#00B884', pressed: '#008F69' },
        'on-emerald': '#04271E',
        line: { DEFAULT: '#E5EDE9', soft: '#EEF4F1' },
        canvas: '#F5FAF8',
        ink: '#172B26',
        subtle: '#778894',
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
