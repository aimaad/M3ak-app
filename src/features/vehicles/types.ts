export type VehicleStatus = 'disponible' | 'en_location' | 'maintenance' | 'a_inspecter';
export type FuelType = 'essence' | 'diesel' | 'hybride' | 'electrique';

export const VEHICLE_STATUSES: VehicleStatus[] = [
  'disponible',
  'en_location',
  'maintenance',
  'a_inspecter',
];

export const FUEL_TYPES: FuelType[] = ['essence', 'diesel', 'hybride', 'electrique'];

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
