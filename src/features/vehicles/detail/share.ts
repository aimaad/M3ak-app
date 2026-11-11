import { plateText } from '../fleet-card';

import { displayName } from './names';

/** Texte partagé depuis la fiche : nom, plaque et prix par jour (propriétaire seulement : aucun montant pour les autres rôles). */
export function shareMessage(vehicle: { marque: string; modele: string; immatriculation: string; prixJour: number }, options: { showPrice: boolean; perDay: string }): string {
  const lines = [displayName(vehicle), plateText(vehicle.immatriculation)];
  if (options.showPrice && vehicle.prixJour > 0) lines.push(`${vehicle.prixJour.toLocaleString('fr-FR')} ${options.perDay}`);
  return lines.join('\n');
}
