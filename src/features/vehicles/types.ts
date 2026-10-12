export type VehicleStatus =
  | 'disponible'
  | 'en_location'
  | 'maintenance'
  | 'a_inspecter'
  | 'en_preparation'
  | 'indisponible';

export const VEHICLE_STATUSES: VehicleStatus[] = [
  'disponible',
  'en_location',
  'maintenance',
  'a_inspecter',
  'en_preparation',
  'indisponible',
];

/** Statuts pilotés par le module locations (départ/retour) — jamais réglables à la main. */
export const SYSTEM_MANAGED_STATUSES: VehicleStatus[] = ['en_location', 'a_inspecter'];

/** Statuts que l'employé peut choisir depuis la fiche véhicule. */
export const MANUAL_VEHICLE_STATUSES: VehicleStatus[] = [
  'disponible',
  'maintenance',
  'en_preparation',
  'indisponible',
];

export type FuelType = 'essence' | 'diesel' | 'hybride' | 'electrique';
export const FUEL_TYPES: FuelType[] = ['essence', 'diesel', 'hybride', 'electrique'];

export type VehicleCategory =
  | 'economique'
  | 'compacte'
  | 'berline'
  | 'suv'
  | 'utilitaire'
  | 'minibus'
  | 'luxe';

export const VEHICLE_CATEGORIES: VehicleCategory[] = [
  'economique',
  'compacte',
  'berline',
  'suv',
  'utilitaire',
  'minibus',
  'luxe',
];

export type VehicleTransmission = 'manuelle' | 'automatique';
export const VEHICLE_TRANSMISSIONS: VehicleTransmission[] = ['manuelle', 'automatique'];

export type VehicleDocumentType = 'carte_grise' | 'assurance' | 'visite_technique';

export const VEHICLE_DOCUMENT_TYPES: VehicleDocumentType[] = [
  'carte_grise',
  'assurance',
  'visite_technique',
];

export type VehicleDocument = {
  type: VehicleDocumentType;
  path: string;
  uploadedAt: string;
  expiresAt: string | null;
};

export type PendingVehicleDocument = {
  type: VehicleDocumentType;
  localUri: string;
  expiresAt: string | null;
};

export type VehiclePhoto = {
  path: string;
  uploadedAt: string;
};

export type Vehicle = {
  id: string;
  agencyId: string;
  branchId: string | null;
  immatriculation: string;
  vin: string | null;
  marque: string;
  modele: string;
  finition: string | null;
  annee: number | null;
  categorie: VehicleCategory | null;
  couleur: string | null;
  nombrePlaces: number | null;
  transmission: VehicleTransmission | null;
  carburant: FuelType;
  kilometrage: number;
  niveauCarburant: number | null;
  statut: VehicleStatus;
  prixJour: number;
  prixSemaine: number | null;
  prixMois: number | null;
  description: string | null;
  photoUrl: string | null;
  photos: VehiclePhoto[];
  documents: VehicleDocument[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VehicleInput = {
  immatriculation: string;
  vin: string | null;
  marque: string;
  modele: string;
  finition: string | null;
  annee: number | null;
  categorie: VehicleCategory | null;
  couleur: string | null;
  nombrePlaces: number | null;
  transmission: VehicleTransmission | null;
  carburant: FuelType;
  kilometrage: number;
  niveauCarburant: number | null;
  statut: VehicleStatus;
  prixJour: number;
  prixSemaine: number | null;
  prixMois: number | null;
  description: string | null;
  /** Filiale du véhicule ; absent = inchangé (un membre de filiale est rattaché automatiquement côté serveur). */
  branchId?: string | null;
};
