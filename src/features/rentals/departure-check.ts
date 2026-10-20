/**
 * Liste de contrôle avant départ : la logique d'évaluation vit côté serveur
 * (rental_departure_check, migration 0029) pour que l'écran et le blocage du départ
 * s'appuient sur la MÊME règle. Ici : lecture sûre de la réponse et aides d'affichage.
 *
 * Rappel : la présence d'un fichier n'est pas une preuve de validité, et une lecture OCR ne
 * certifie ni l'authenticité d'un document ni le droit de conduire. Seule la confirmation
 * humaine (horodatée et attribuée) atteste que la vérification a eu lieu.
 */

export type IssueSeverity = 'blocking' | 'warning';

export type IssueCode =
  | 'licence_missing'
  | 'licence_no_file'
  | 'licence_expiry_unknown'
  | 'licence_expired'
  | 'licence_expires_before_end'
  | 'id_missing'
  | 'id_expired'
  | 'id_expires_before_end';

export type DepartureIssue = { code: IssueCode | string; severity: IssueSeverity };

export type PartyKind = 'client' | 'conducteur_principal' | 'conducteur_supplementaire';

export type DepartureDocument = {
  id: string;
  type: string;
  expiresAt: string | null;
  hasFile: boolean;
};

export type DepartureParty = {
  key: string;
  kind: PartyKind;
  name: string;
  isDriver: boolean;
  documents: DepartureDocument[];
  issues: DepartureIssue[];
};

export type DeparturePolicy = {
  blockDeparture: boolean;
  requireCustomerIdDocument: boolean;
  requireDriverLicence: boolean;
  requireLicenceValidUntilEnd: boolean;
  requireManualConfirmation: boolean;
  confirmationRole: 'employee' | 'manager';
  maxAdditionalDrivers: number;
  /** Exige un CIN ou un passeport enregistré pour créer une location (décision du propriétaire). */
  requireIdAtRental: boolean;
  /** Exige le permis (recto, verso, numéro, expiration) pour créer un client particulier (décision du propriétaire). */
  requireLicenceAtCustomer: boolean;
  /** Les employés peuvent ignorer la prise de photos de l'inspection (décision du propriétaire). */
  allowSkipInspection: boolean;
  /** Les employés peuvent refuser l'analyse de M3ak (décision du propriétaire). */
  allowDeclineAi: boolean;
};

export type DepartureCheck = {
  rentalId: string;
  policy: DeparturePolicy;
  parties: DepartureParty[];
  blockingCount: number;
  warningCount: number;
  confirmation: {
    confirmed: boolean;
    stale: boolean;
    confirmedByName: string | null;
    confirmedAt: string | null;
  };
  /** La politique de l'agence bloque réellement le départ (sinon la liste est informative). */
  enforced: boolean;
  /** Toutes les exigences sont satisfaites (documents + confirmation si requise). */
  ok: boolean;
  /** Le départ est possible : politique inactive, ou exigences satisfaites. */
  canDepart: boolean;
};

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null;
const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const asBool = (value: unknown): boolean => value === true;
const asNumber = (value: unknown, fallback = 0): number => (typeof value === 'number' ? value : fallback);

/** Lecture défensive de la réponse JSON du serveur. */
export function parseDepartureCheck(raw: unknown): DepartureCheck {
  const source: Raw = isObject(raw) ? raw : {};
  const policy: Raw = isObject(source.policy) ? source.policy : {};
  const confirmation: Raw = isObject(source.confirmation) ? source.confirmation : {};

  const parties: DepartureParty[] = (Array.isArray(source.parties) ? source.parties : [])
    .filter(isObject)
    .map((party) => ({
      key: asString(party.key) ?? '',
      kind: (asString(party.kind) ?? 'client') as PartyKind,
      name: asString(party.name) ?? '',
      isDriver: asBool(party.is_driver),
      documents: (Array.isArray(party.documents) ? party.documents : []).filter(isObject).map((doc) => ({
        id: asString(doc.id) ?? '',
        type: asString(doc.type) ?? '',
        expiresAt: asString(doc.expires_at),
        hasFile: asBool(doc.has_file),
      })),
      issues: (Array.isArray(party.issues) ? party.issues : []).filter(isObject).map((issue) => ({
        code: asString(issue.code) ?? '',
        severity: issue.severity === 'blocking' ? 'blocking' : 'warning',
      })),
    }));

  return {
    rentalId: asString(source.rental_id) ?? '',
    policy: {
      blockDeparture: asBool(policy.block_departure),
      requireCustomerIdDocument: asBool(policy.require_customer_id_document),
      requireDriverLicence: asBool(policy.require_driver_licence),
      requireLicenceValidUntilEnd: asBool(policy.require_licence_valid_until_end),
      requireManualConfirmation: asBool(policy.require_manual_confirmation),
      confirmationRole: policy.confirmation_role === 'manager' ? 'manager' : 'employee',
      maxAdditionalDrivers: asNumber(policy.max_additional_drivers, 3),
      requireIdAtRental: asBool(policy.require_id_at_rental),
      requireLicenceAtCustomer: policy.require_licence_at_customer === undefined ? true : asBool(policy.require_licence_at_customer),
      allowSkipInspection: policy.allow_skip_inspection === undefined ? true : asBool(policy.allow_skip_inspection),
      allowDeclineAi: policy.allow_decline_ai === undefined ? true : asBool(policy.allow_decline_ai),
    },
    parties,
    blockingCount: asNumber(source.blocking_count),
    warningCount: asNumber(source.warning_count),
    confirmation: {
      confirmed: asBool(confirmation.confirmed),
      stale: asBool(confirmation.stale),
      confirmedByName: asString(confirmation.confirmed_by_name),
      confirmedAt: asString(confirmation.confirmed_at),
    },
    enforced: asBool(source.enforced),
    ok: asBool(source.ok),
    canDepart: asBool(source.can_depart),
  };
}

export type ConfirmationState = 'not_required' | 'pending' | 'confirmed' | 'stale';

export function confirmationState(check: DepartureCheck): ConfirmationState {
  if (!check.policy.requireManualConfirmation) return 'not_required';
  if (!check.confirmation.confirmed) return 'pending';
  return check.confirmation.stale ? 'stale' : 'confirmed';
}

/** Peut-on proposer le bouton « Confirmer la vérification » ? Pas tant qu'il reste un blocage documentaire. */
export function canConfirmCheck(check: DepartureCheck, role: 'owner' | 'manager' | 'employee' | null): boolean {
  if (!role) return false;
  if (check.blockingCount > 0) return false;
  if (check.policy.confirmationRole === 'manager' && role === 'employee') return false;
  return confirmationState(check) !== 'confirmed';
}

/** Résumé pour l'en-tête de la liste de contrôle. */
export type CheckSummary = 'blocked' | 'confirmation_needed' | 'ready' | 'ready_with_warnings';

export function summarizeCheck(check: DepartureCheck): CheckSummary {
  if (check.blockingCount > 0) return 'blocked';
  const state = confirmationState(check);
  if (state === 'pending' || state === 'stale') return 'confirmation_needed';
  return check.warningCount > 0 ? 'ready_with_warnings' : 'ready';
}

/** Clé de traduction d'une anomalie. */
export function issueMessageKey(issue: DepartureIssue): string {
  return `locations.departureCheck.issues.${issue.code}`;
}

/** Messages d'erreur serveur pour le départ / la confirmation. */
export function departureErrorKey(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  for (const code of [
    'departure_requirements_not_met',
    'confirmation_requires_manager',
    'rental_not_ready_for_departure',
    'rental_not_found',
  ]) {
    if (message.includes(code)) return `locations.departureCheck.errors.${code}`;
  }
  return 'locations.departureCheck.errors.generic';
}

/** Valeurs par défaut de la politique (alignées sur get_departure_policy côté serveur). */
export const DEFAULT_DEPARTURE_POLICY: DeparturePolicy = {
  blockDeparture: false,
  requireCustomerIdDocument: true,
  requireDriverLicence: true,
  requireLicenceValidUntilEnd: true,
  requireManualConfirmation: true,
  confirmationRole: 'employee',
  maxAdditionalDrivers: 3,
  requireIdAtRental: false,
  requireLicenceAtCustomer: true,
  allowSkipInspection: true,
  allowDeclineAi: true,
};
