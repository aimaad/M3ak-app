/**
 * M3ak n'a qu'un thème (clair) : toutes les surfaces (cartes, boutons, champs) sont blanches. Suivre le mode sombre du
 * téléphone donnait du texte clair sur fond blanc. On renvoie donc toujours « light ».
 */
export function useColorScheme(): 'light' {
  return 'light';
}
