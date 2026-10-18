export type InspectionType = 'depart' | 'retour';
export type InspectionStatus = 'en_cours' | 'terminee' | 'validee';

export type PhotoAngle =
  | 'avant'
  | 'avant_gauche'
  | 'lateral_gauche'
  | 'arriere_gauche'
  | 'arriere'
  | 'arriere_droit'
  | 'lateral_droit'
  | 'avant_droit'
  | 'capot'
  | 'toit'
  | 'pare_brise'
  | 'jante_avant_gauche'
  | 'jante_avant_droit'
  | 'jante_arriere_gauche'
  | 'jante_arriere_droit'
  | 'tableau_de_bord'
  | 'volant'
  | 'frein_a_main'
  | 'siege_avant_gauche'
  | 'siege_avant_droit'
  | 'banquette_arriere'
  | 'plafond'
  | 'tapis'
  | 'coffre_interieur'
  | 'interieur'
  | 'autre';

export type AngleGroup = 'exterieur' | 'roues' | 'interieur';

/**
 * Guide de capture complet, dans l'ordre : on fait le tour de la voiture, puis les roues, puis l'intérieur.
 * Chaque angle a une consigne précise (inspection.angleHints.*) pour que les départs et les retours soient
 * pris EXACTEMENT de la même façon, ce qui permet à l'IA de comparer.
 */
export const CAPTURE_PLAN: { group: AngleGroup; angles: PhotoAngle[] }[] = [
  {
    group: 'exterieur',
    angles: ['avant', 'avant_gauche', 'lateral_gauche', 'arriere_gauche', 'arriere', 'arriere_droit', 'lateral_droit', 'avant_droit', 'capot', 'toit', 'pare_brise'],
  },
  { group: 'roues', angles: ['jante_avant_gauche', 'jante_avant_droit', 'jante_arriere_gauche', 'jante_arriere_droit'] },
  {
    group: 'interieur',
    angles: ['tableau_de_bord', 'volant', 'frein_a_main', 'siege_avant_gauche', 'siege_avant_droit', 'banquette_arriere', 'plafond', 'tapis', 'coffre_interieur'],
  },
];

export const CAPTURE_ANGLES: PhotoAngle[] = CAPTURE_PLAN.flatMap((entry) => entry.angles);

/**
 * Un angle peut être ignoré (voiture sans banquette arrière, toit ouvrant, pickup…) sauf le tour extérieur, les roues
 * et le tableau de bord (kilométrage et carburant) : sans eux la comparaison départ / retour n'aurait pas de sens.
 */
export function isSkippableAngle(angle: PhotoAngle): boolean {
  return angleGroupOf(angle) === 'interieur' && angle !== 'tableau_de_bord';
}

export function angleGroupOf(angle: PhotoAngle): AngleGroup | null {
  return CAPTURE_PLAN.find((entry) => entry.angles.includes(angle))?.group ?? null;
}

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
  kilometrage: number | null;
  niveauCarburant: number | null;
  proprete: 'propre' | 'correcte' | 'sale' | null;
  analysisStatus: AnalysisStatus;
  analyzedAt: string | null;
  aiSummary: string | null;
  failedZones: string[];
};

export type AnalysisStatus = 'aucune' | 'en_cours' | 'terminee' | 'partielle' | 'echec';

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
