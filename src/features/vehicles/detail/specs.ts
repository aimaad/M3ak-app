/** Fiche technique : 8 tuiles (catégorie, boîte, carburant, kilométrage, couleur, année, places, puissance). Une donnée absente = « À compléter ». */
import type { Vehicle } from '../types';

export type SpecKey = 'categorie' | 'transmission' | 'carburant' | 'kilometrage' | 'couleur' | 'annee' | 'nombrePlaces' | 'puissanceFiscale';

export type SpecTile = {
  key: SpecKey;
  /** Champ du formulaire à ouvrir (même nom que la clé). */
  field: SpecKey;
  missing: boolean;
  /** Clé de traduction de la valeur (catégorie, boîte, carburant). */
  valueKey?: string;
  /** Valeur brute (nombre ou texte) à mettre en forme par l'écran. */
  value?: string | number;
};

export function buildSpecs(vehicle: Vehicle): SpecTile[] {
  const tile = (key: SpecKey, value: string | number | null | undefined, valueKey?: string): SpecTile => {
    const missing = value === null || value === undefined || value === '' || value === 0;
    return missing ? { key, field: key, missing: true } : { key, field: key, missing: false, value, ...(valueKey ? { valueKey } : {}) };
  };
  return [
    tile('categorie', vehicle.categorie, vehicle.categorie ? `vehicle.category.${vehicle.categorie}` : undefined),
    tile('transmission', vehicle.transmission, vehicle.transmission ? `vehicle.transmission.${vehicle.transmission}` : undefined),
    tile('carburant', vehicle.carburant, `vehicle.fuel.${vehicle.carburant}`),
    tile('kilometrage', vehicle.kilometrage),
    tile('couleur', vehicle.couleur?.trim()),
    tile('annee', vehicle.annee),
    tile('nombrePlaces', vehicle.nombrePlaces),
    tile('puissanceFiscale', vehicle.puissanceFiscale),
  ];
}
