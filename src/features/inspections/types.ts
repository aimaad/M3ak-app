export type InspectionType = 'depart' | 'retour';
export type InspectionStatus = 'en_cours' | 'terminee' | 'validee';

export type PhotoAngle =
  | 'avant'
  | 'arriere'
  | 'lateral_gauche'
  | 'lateral_droit'
  | 'jante_avant_gauche'
  | 'jante_avant_droit'
  | 'jante_arriere_gauche'
  | 'jante_arriere_droit'
  | 'interieur'
  | 'tableau_de_bord'
  | 'autre';

/** Ordre du guide de capture proposé à l'employé (4 à 8 angles, voir docs/ARCHITECTURE.md). */
export const CAPTURE_ANGLES: PhotoAngle[] = [
  'avant',
  'arriere',
  'lateral_gauche',
  'lateral_droit',
  'jante_avant_gauche',
  'jante_avant_droit',
  'jante_arriere_gauche',
  'jante_arriere_droit',
];

export type Inspection = {
  id: string;
  agencyId: string;
  rentalId: string;
  vehicleId: string;
  type: InspectionType;
  statut: InspectionStatus;
  employeeId: string | null;
  dateInspection: string;
  createdAt: string;
};

export type InspectionPhoto = {
  id: string;
  inspectionId: string;
  agencyId: string;
  angle: PhotoAngle;
  url: string;
  createdAt: string;
};

export type PendingPhoto = {
  id: string;
  inspectionId: string;
  agencyId: string;
  angle: PhotoAngle;
  localUri: string;
  createdAt: string;
};
