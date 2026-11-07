/**
 * SOURCE DE VÉRITÉ des couleurs BIBIP (identité « Emerald Ivory »).
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

module.exports = {
  brand,
  light,
  dark,
  // Anciennes valeurs « Emerald Ivory » : temporaires, supprimées à l'étape « remplacement des couleurs ».
  BRAND: {
    /** Émeraude signature : boutons, navigation, liens. 4,9:1 avec du texte blanc, 4,6:1 sur l'ivoire. */
    primary: '#087F70',
    /** Émeraude appuyé (état pressé) : 6,4:1 avec du texte blanc. */
    primaryPressed: '#066B5F',
    /** Deep Forest : hero, cartes premium, onglet actif (blanc dessus : 13:1). */
    primaryDeep: '#102D2A',
    /** Vert nuit : fonds les plus sombres (ouverture, barre d'état, ombres). */
    night: '#0A1F1C',
    primaryLight: '#DDF1EC',
    primarySoft: '#EEF7F4',
    /** Menthe (« Soutien ») : accents et lumières sur fond sombre (12:1 sur le Deep Forest). */
    mint: '#C9F6ED',
    /** Lime (accent) : réservé aux petites touches sur fond sombre (traits, points). */
    lime: '#D9FF43',
    /** Ivoire : fond principal de l'application. */
    background: '#FAF8F1',
    /** Blanc pur : cartes et surfaces. */
    surface: '#FFFFFF',
    ink: '#202B29',
    /** Texte secondaire : au moins 4,5:1 sur blanc, sur l'ivoire et sur les teintes claires. */
    muted: '#5B6866',
    /** Icônes et textes d'appoint inactifs : 3:1 sur blanc, jamais pour du texte courant. */
    subtle: '#8A9593',
    border: '#E7E3D4',
    borderSoft: '#F0EDE1',
    /** Disponible / succès (un vert franc, distinct de l'émeraude de la marque). */
    success: '#2E8B57',
    successText: '#1E6B3A',
    successLight: '#E3F3E8',
    /** En location / information. */
    info: '#5479C7',
    infoText: '#3F62AD',
    infoLight: '#E8EEF9',
    /** Maintenance / attention (le texte sur ambre est le brun foncé : 5,3:1). */
    warning: '#D99835',
    warningText: '#8A5A0B',
    warningLight: '#FBF1DE',
    /** Retard / erreur. */
    danger: '#C8443B',
    dangerText: '#A8322B',
    dangerLight: '#FBE8E6',
    dangerBorder: '#F0C9C5',
    /** Indisponible / neutre. */
    neutral: '#8E9693',
    neutralText: '#5B6866',
    neutralLight: '#EFEEE6',
    /** Texte sur le bouton principal. */
    onPrimary: '#FFFFFF',
  },
};
