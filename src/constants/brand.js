/**
 * SOURCE DE VÉRITÉ des couleurs BIBIP (identité « Emerald Ivory »).
 *
 * Fichier en CommonJS pour être lu à la fois par l'application (`theme.ts`) et par `tailwind.config.js` : une seule
 * liste de valeurs, aucune copie à tenir à jour. Les noms sont des RÔLES (primary = émeraude de la marque).
 * Le logo BIBIP a ses propres couleurs (ses verts, son accent lime) : il n'est JAMAIS recoloré pour suivre cette palette.
 */
module.exports = {
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
