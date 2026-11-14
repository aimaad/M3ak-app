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
  /** Ajout de véhicule : fond plein écran du scanner de carte grise et fond de son panneau du bas. */
  scannerBackground: '#0B0D0E',
  scannerPanel: '#151819',
  /** Fiche véhicule en retard : fond de la carte d'état (rouge très sombre). */
  errorDeep: '#3A2228',
  /** Écran Photos du véhicule (plein écran sombre) : fond, emplacement vide, pointillés, contours, « Principale », « Supprimer ». */
  photoScreenBackground: '#161A1B',
  slotEmptyOnDark: '#1D2122',
  slotDashOnDark: '#4A5154',
  slotIconOnDark: '#8A9193',
  panelStrokeOnDark: '#343B3E',
  mainFillOnDark: '#3A3220',
  dangerFillOnDark: '#2A1E21',
  dangerStrokeOnDark: '#5A2A33',
  /** Kit de formulaire (src/components/form) : fonds et contours d'état des champs, puces de suggestion, séparateurs. */
  aiBadgeFill: '#FFF1EA',
  errorFieldFill: '#FFF5F7',
  dangerBorder: '#F2B8C4',
  lockedFill: '#EEF0F0',
  lockedBorder: '#D5D8D9',
  suggestFill: '#FFF6F1',
  suggestBorder: '#F3C9B3',
  listSeparator: '#EEEFEF',
  /** Pastilles de couleur du véhicule (données, pas du style) : Blanc, Noir, Gris, Argent, Rouge, Bleu, Beige, et leur contour. */
  swatchBlanc: '#FFFFFF',
  swatchNoir: '#16191A',
  swatchGris: '#8A9092',
  swatchArgent: '#C9CED1',
  swatchRouge: '#B3262E',
  swatchBleu: '#244C8F',
  swatchBeige: '#D8C8A8',
  swatchEdge: '#D3D6D7',
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
