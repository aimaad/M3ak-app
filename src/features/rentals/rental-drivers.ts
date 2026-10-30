import { isSamePerson, type DriverCandidate } from '@/features/customers/driver-candidates';

/** Nombre maximal de conducteurs supplémentaires proposé par défaut (configurable par l'agence). */
export const DEFAULT_MAX_ADDITIONAL_DRIVERS = 3;

/**
 * Conducteurs d'une réservation. Le client contractuel (celui qui réserve et paie) est distinct
 * des conducteurs autorisés :
 * - principal = null  → le client conduit lui-même (cas le plus courant) ;
 * - principal = une personne → un autre conducteur principal ;
 * - additional = conducteurs supplémentaires.
 */
export type RentalDriversSelection = {
  principal: DriverCandidate | null;
  additional: DriverCandidate[];
};

export const EMPTY_DRIVERS_SELECTION: RentalDriversSelection = { principal: null, additional: [] };

export type AddDriverError = 'duplicate' | 'is_customer' | 'too_many';

export type AddDriverResult =
  | { ok: true; selection: RentalDriversSelection }
  | { ok: false; error: AddDriverError; selection: RentalDriversSelection };

type Context = {
  /** Client qui réserve : s'il est le conducteur principal par défaut, on ne peut pas l'ajouter une 2e fois. */
  customerId: string | null;
  maxAdditional?: number;
};

function isBookingCustomer(candidate: DriverCandidate, ctx: Context): boolean {
  return !!ctx.customerId && candidate.customerId === ctx.customerId;
}

/** Ajoute un conducteur supplémentaire (refuse les doublons, le client déjà principal et le dépassement). */
export function addAdditionalDriver(
  selection: RentalDriversSelection,
  candidate: DriverCandidate,
  ctx: Context
): AddDriverResult {
  const max = ctx.maxAdditional ?? DEFAULT_MAX_ADDITIONAL_DRIVERS;

  // Le client conduit déjà (principal par défaut) : il ne peut pas être aussi supplémentaire.
  if (selection.principal === null && isBookingCustomer(candidate, ctx)) {
    return { ok: false, error: 'is_customer', selection };
  }
  if (selection.principal && isSamePerson(selection.principal, candidate)) {
    return { ok: false, error: 'duplicate', selection };
  }
  if (selection.additional.some((existing) => isSamePerson(existing, candidate))) {
    return { ok: false, error: 'duplicate', selection };
  }
  if (selection.additional.length >= max) {
    return { ok: false, error: 'too_many', selection };
  }
  return { ok: true, selection: { ...selection, additional: [...selection.additional, candidate] } };
}

/** Retire un conducteur supplémentaire (avant la confirmation de la réservation). */
export function removeAdditionalDriver(selection: RentalDriversSelection, key: string): RentalDriversSelection {
  return { ...selection, additional: selection.additional.filter((candidate) => candidate.key !== key) };
}

/**
 * Définit le conducteur principal parmi les conducteurs associés ; null = le client lui-même.
 * L'ancien principal devient conducteur supplémentaire (personne n'est perdu), et le nouveau
 * principal sort de la liste des supplémentaires.
 */
export function setPrincipalDriver(
  selection: RentalDriversSelection,
  candidate: DriverCandidate | null,
  ctx: Context
): RentalDriversSelection {
  const previous = selection.principal;
  let additional = selection.additional;

  if (candidate) {
    additional = additional.filter((existing) => !isSamePerson(existing, candidate));
  }
  if (previous && (!candidate || !isSamePerson(previous, candidate))) {
    const alreadyListed = additional.some((existing) => isSamePerson(existing, previous));
    if (!alreadyListed) additional = [...additional, previous];
  }
  // Le client redevient principal : il ne reste pas dans les supplémentaires.
  if (!candidate) {
    additional = additional.filter((existing) => !isBookingCustomer(existing, ctx));
  }
  return { principal: candidate, additional };
}

/** Réponse à « Y a-t-il d'autres conducteurs ? » : vrai dès qu'une personne autre que le client est associée. */
export function hasOtherDrivers(selection: RentalDriversSelection): boolean {
  return selection.principal !== null || selection.additional.length > 0;
}

/** Messages d'erreur des règles serveur (set_rental_drivers) → clé de traduction. */
export function rentalDriversErrorKey(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  for (const code of ['duplicate_driver', 'too_many_additional_drivers', 'rental_drivers_locked', 'rental_not_found']) {
    if (message.includes(code)) return `locations.drivers.errors.${code}`;
  }
  if (message.includes('agency_mismatch')) return 'locations.drivers.errors.agency_mismatch';
  return 'locations.drivers.errors.generic';
}
