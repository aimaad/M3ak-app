/** @type {import('tailwindcss').Config} */
const { brand, light } = require('./src/constants/brand');

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Jetons BIBIP (graphite + orange) : mêmes valeurs que src/constants/brand.js (source de vérité unique).
        background: light.background,
        surface: { DEFAULT: light.surface, alt: light.surfaceAlt },
        card: light.card,
        border: light.border,
        content: { DEFAULT: light.textPrimary, secondary: light.textSecondary, muted: light.textMuted },
        primary: {
          DEFAULT: light.primary,
          pressed: light.primaryPressed,
          soft: light.primarySoft,
          'on-soft': light.onPrimarySoft,
        },
        'on-primary': light.onPrimary,
        accent: light.accentText,
        graphite: brand.graphite,
        orange: { DEFAULT: brand.orange, light: brand.orangeLight },
        success: { DEFAULT: light.success, soft: light.successSoft },
        error: { DEFAULT: light.error, soft: light.errorSoft },
        warning: { DEFAULT: light.warning, soft: light.warningSoft },
        info: { DEFAULT: light.info, soft: light.infoSoft },
        overlay: light.overlay,
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
