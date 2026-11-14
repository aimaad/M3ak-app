/** Obligations réglementaires d'un véhicule : une ligne = une période couverte (voir migration 0069). */
export type ComplianceKind = 'assurance' | 'visite_technique' | 'vignette';
export const COMPLIANCE_KINDS: ComplianceKind[] = ['assurance', 'visite_technique', 'vignette'];

export type ComplianceRecord = {
  id: string;
  agencyId: string;
  vehicleId: string;
  kind: ComplianceKind;
  /** AAAA-MM-JJ, facultatif. */
  validFrom: string | null;
  /** AAAA-MM-JJ : DERNIER jour couvert (inclus). */
  validUntil: string;
  /** N° de police (assurance), de procès-verbal (visite) ou de quittance (vignette). */
  reference: string | null;
  /** Assureur ou centre de visite. */
  provider: string | null;
  amount: number | null;
  documentPath: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type ComplianceInput = {
  vehicleId: string;
  kind: ComplianceKind;
  validFrom: string | null;
  validUntil: string;
  reference: string | null;
  provider: string | null;
  amount: number | null;
  documentPath: string | null;
  notes: string | null;
};

export type ComplianceSettings = { visitIntervalMonths: number };
export const DEFAULT_COMPLIANCE_SETTINGS: ComplianceSettings = { visitIntervalMonths: 6 };
