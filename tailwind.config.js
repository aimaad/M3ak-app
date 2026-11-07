/** @type {import('tailwindcss').Config} */
const { BRAND, brand, light } = require('./src/constants/brand');

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Jetons BIBIP : mêmes valeurs que src/constants/brand.js (source de vérité unique).
        brand: { DEFAULT: BRAND.primary, deep: BRAND.primaryDeep, light: BRAND.primaryLight, soft: BRAND.primarySoft },
        primary: {
          DEFAULT: BRAND.primary,
          pressed: BRAND.primaryPressed,
          soft: light.primarySoft,
          'on-soft': light.onPrimarySoft,
        },
        // Nouveaux tokens sémantiques (thème clair) : remplacent les anciens noms à l'étape suivante.
        background: light.background,
        surface: { DEFAULT: light.surface, alt: light.surfaceAlt },
        card: light.card,
        border: light.border,
        content: { DEFAULT: light.textPrimary, secondary: light.textSecondary, muted: light.textMuted },
        accent: light.accentText,
        graphite: brand.graphite,
        orange: { DEFAULT: brand.orange, light: brand.orangeLight },
        success: { DEFAULT: light.success, soft: light.successSoft },
        error: { DEFAULT: light.error, soft: light.errorSoft },
        warning: { DEFAULT: light.warning, soft: light.warningSoft },
        info: { DEFAULT: light.info, soft: light.infoSoft },
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
