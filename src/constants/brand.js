/**
 * SOURCE DE VÉRITÉ des couleurs BIBIP (identité graphite + orange).
 *
 * Fichier en CommonJS pour être lu à la fois par l'application (`theme.ts`) et par `tailwind.config.js` : une seule
 * liste de valeurs, aucune copie à tenir à jour. Les noms sont des RÔLES (primary = émeraude de la marque).
 * Le logo BIBIP a ses propres couleurs (ses verts, son accent lime) : il n'est JAMAIS recoloré pour suivre cette palette.
 */
/**
 * NOUVELLE IDENTITÉ (graphite + orange) : thèmes clair et sombre, tokens sémantiques. L'app reste en mode clair forcé
 * (`userInterfaceStyle: "light"`) : le thème sombre est prêt mais pas branché (chantier séparé).
 * Les composants utilisent ces tokens, jamais de valeur hex directement.
 */
const brand = {
  /** Gris anthracite de la marque. */
  graphite: '#202527',
  /** Orange de la marque (boutons, accents). */
  orange: '#CA531D',
  /** Orange pour texte et icônes sur fond sombre. */
  orangeLight: '#EC7A45',
  white: '#FFFFFF',
  // --- Accueil : tokens des surfaces graphite (en-tête, cartes de priorités, barre flottante) ---
  /** Filets et bordures sur fond graphite. */
  borderOnDark: '#343B3E',
  /** Surface (avatar, pastilles) sur fond graphite. */
  surfaceOnDark: '#2A3033',
  /** Contours de boutons sur fond graphite. */
  strokeOnDark: '#40484B',
  /** Fond de la carte « Reste à encaisser » (orange très sombre). */
  orangeDeep: '#3A2A22',
  /** Texte secondaire et texte clair sur fond graphite. */
  mutedOnDark: '#B4BABC',
  textOnDark: '#F4F5F5',
  /** Couleurs fonctionnelles sur fond graphite. */
  successOnDark: '#4CC38A',
  warningOnDark: '#F2C94C',
  errorOnDark: '#F0657F',
  /** Fond de la jauge du parc. */
  gaugeTrack: '#EDEEEE',
  /** « À inspecter » dans le parc. */
  parcInspect: '#E0B000',
  /** Ma Flotte : bordure de la carte « Conseil BIBIP » (sur orangeDeep). */
  orangeDeepBorder: '#6B3A22',
  /** Ma Flotte : texte d'une échéance urgente sur fond clair (orange foncé, contraste suffisant). */
  orangeUrgentText: '#B5481A',
};

const light = {
  background: '#FFFFFF',
  surface: '#F6F6F5',
  surfaceAlt: '#EDEEEE',
  /** Fond des cartes : blanc + bordure `border`, sans ombre (arbitrage 6). */
  card: '#FFFFFF',
  border: '#E2E4E5',
  textPrimary: '#202527',
  textSecondary: '#5E6466',
  /** Placeholders, métadonnées : jamais pour du texte important. */
  textMuted: '#8A9092',
  primary: '#CA531D',
  primaryPressed: '#A84416',
  onPrimary: '#FFFFFF',
  primarySoft: '#FBEDE6',
  onPrimarySoft: '#A84416',
  /** Prix, liens, texte orange : uniquement en taille ≥ 16 px ou en gras. */
  accentText: '#CA531D',
  success: '#1A7F53',
  successSoft: '#E3F3EB',
  error: '#C42B4B',
  errorSoft: '#FBE6EA',
  warning: '#7A5A00',
  warningSoft: '#FFF6D6',
  info: '#3D6FB6',
  infoSoft: '#E6EEF8',
  overlay: 'rgba(32,37,39,0.55)',
  /** Ombre neutre très légère, réservée aux éléments flottants (bouton « + », bottom sheets, modales). */
  shadow: '#202527',
};

const dark = {
  background: '#202527',
  surface: '#2A3033',
  surfaceAlt: '#343B3E',
  card: '#2A3033',
  border: '#40484B',
  textPrimary: '#F4F5F5',
  textSecondary: '#B4BABC',
  textMuted: '#80878A',
  primary: '#CA531D',
  primaryPressed: '#B04818',
  onPrimary: '#FFFFFF',
  primarySoft: '#3A2A22',
  onPrimarySoft: '#EC7A45',
  /** Ne JAMAIS utiliser #CA531D en texte sur fond sombre : contraste insuffisant. */
  accentText: '#EC7A45',
  success: '#4CC38A',
  successSoft: '#1F3A2E',
  error: '#F0657F',
  errorSoft: '#3D2229',
  warning: '#F2C94C',
  warningSoft: '#3A3320',
  info: '#7FA8E6',
  infoSoft: '#223246',
  overlay: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
};

module.exports = { brand, light, dark };
