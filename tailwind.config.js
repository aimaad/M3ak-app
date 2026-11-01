/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Jetons M3ak : mêmes valeurs que src/constants/theme.ts (M3akPalette).
        brand: { DEFAULT: '#684394', deep: '#35204F', light: '#EDE6F3', soft: '#F3EFF8' },
        primary: { DEFAULT: '#684394', pressed: '#563679' },
        'on-primary': '#FFFFFF',
        lavender: '#B69ACF',
        line: { DEFAULT: '#E6E0EE', soft: '#EFEAF5' },
        canvas: '#F7F5FA',
        ink: '#171321',
        subtle: '#8A849A',
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
