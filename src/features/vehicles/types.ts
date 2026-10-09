export type VehicleStatus = 'disponible' | 'en_location' | 'maintenance' | 'a_inspecter';
export type FuelType = 'essence' | 'diesel' | 'hybride' | 'electrique';

export const VEHICLE_STATUSES: VehicleStatus[] = [
  'disponible',
  'en_location',
  'maintenance',
  'a_inspecter',
];

export const FUEL_TYPES: FuelType[] = ['essence', 'diesel', 'hybride', 'electrique'];

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
};

export type PendingVehicleDocument = {
  type: VehicleDocumentType;
  localUri: string;
};

export type Vehicle = {
  id: string;
  agencyId: string;
  branchId: string | null;
  immatriculation: string;
  marque: string;
  modele: string;
  annee: number | null;
  carburant: FuelType;
  kilometrage: number;
  statut: VehicleStatus;
  prixJour: number;
  photoUrl: string | null;
  documents: VehicleDocument[];
  createdAt: string;
  updatedAt: string;
};

export type VehicleInput = {
  immatriculation: string;
  marque: string;
  modele: string;
  annee: number | null;
  carburant: FuelType;
  kilometrage: number;
  statut: VehicleStatus;
  prixJour: number;
};
