export type ContractStatus = 'preparation' | 'pret_a_signer' | 'signe' | 'en_cours' | 'cloture' | 'annule';

export const CONTRACT_STATUSES: ContractStatus[] = [
  'preparation',
  'pret_a_signer',
  'signe',
  'en_cours',
  'cloture',
  'annule',
];

export type VehicleCondition = 'bon' | 'moyen' | 'mauvais';
export const VEHICLE_CONDITIONS: VehicleCondition[] = ['bon', 'moyen', 'mauvais'];

export type AccessoryKey =
  | 'roue_secours'
  | 'triangle_gilet'
  | 'cric'
  | 'extincteur'
  | 'autoradio_gps'
  | 'chargeur'
  | 'carte_grise_vehicule'
  | 'assurance_vehicule';

export const ACCESSORY_KEYS: AccessoryKey[] = [
  'roue_secours',
  'triangle_gilet',
  'cric',
  'extincteur',
  'autoradio_gps',
  'chargeur',
  'carte_grise_vehicule',
  'assurance_vehicule',
];

export type Contract = {
  id: string;
  agencyId: string;
  rentalId: string;
  numero: string;
  statut: ContractStatus;

  customerNom: string;
  customerTelephone: string | null;
  customerCin: string | null;
  driverNom: string | null;
  /** Conducteurs supplémentaires au moment de la création du contrat (instantané). */
  autresConducteurs: string[];
  vehicleImmatriculation: string;
  vehicleMarque: string;
  vehicleModele: string;
  dateDebutPrevue: string;
  dateFinPrevue: string;
  prixTotal: number | null;
  cautionMontant: number;

  conditionsParticulieres: string | null;
  notes: string | null;

  signedAt: string | null;
  signedBy: string | null;

  etatDepart: VehicleCondition | null;
  accessoiresDepart: AccessoryKey[];
  observationsDepart: string | null;

  etatRetour: VehicleCondition | null;
  accessoiresRetour: AccessoryKey[];
  observationsRetour: string | null;
  retardMinutes: number | null;
  fraisRetardPropose: number | null;
  fraisCarburantPropose: number | null;
  fraisJustification: string | null;
  fraisAppliques: boolean;

  pdfPath: string | null;

  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContractCreateInput = {
  rentalId: string;
  conditionsParticulieres: string | null;
  notes: string | null;
};

export type DepartContractInput = {
  etatDepart: VehicleCondition;
  accessoiresDepart: AccessoryKey[];
  observationsDepart: string | null;
};

export type RetourContractInput = {
  etatRetour: VehicleCondition;
  accessoiresRetour: AccessoryKey[];
  observationsRetour: string | null;
  retardMinutes: number;
  fraisRetardPropose: number;
  fraisCarburantPropose: number;
  fraisJustification: string | null;
  appliquerFrais: boolean;
};
