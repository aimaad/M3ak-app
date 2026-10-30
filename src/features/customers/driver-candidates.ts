import type { Customer, Driver, DriverInput } from './types';

/**
 * Une personne susceptible de conduire pour une location : un client existant, un conducteur
 * déjà enregistré, ou un nouveau conducteur en cours de saisie (pas encore créé en base).
 */
export type DriverCandidate = {
  /** Clé unique stable utilisée pour la sélection et l'anti-doublon. */
  key: string;
  kind: 'customer' | 'driver' | 'new';
  customerId: string | null;
  driverId: string | null;
  nomComplet: string;
  telephone: string | null;
  numeroPermis: string | null;
  cinOuPasseport: string | null;
  /** Pour un conducteur existant : le client auquel il est rattaché (information d'affichage). */
  ownerCustomerName: string | null;
  /** Pour un nouveau conducteur : les données à enregistrer. */
  draft: DriverInput | null;
};

/** Numéro national marocain : les 9 derniers chiffres (+212661234567 et 0661234567 sont identiques). */
export function canonicalPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/\D+/g, '').slice(-9);
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeId(value: string | null | undefined): string {
  return value ? value.replace(/[\s./-]+/g, '').toLowerCase() : '';
}

export function customerCandidate(customer: Customer, linkedDriverId: string | null = null): DriverCandidate {
  return {
    key: `customer:${customer.id}`,
    kind: 'customer',
    customerId: customer.id,
    driverId: linkedDriverId,
    nomComplet: customer.nomComplet,
    telephone: customer.telephone,
    numeroPermis: customer.numeroPermis,
    cinOuPasseport: customer.cinOuPasseport,
    ownerCustomerName: null,
    draft: null,
  };
}

export function driverCandidate(driver: Driver, ownerName: string | null): DriverCandidate {
  return {
    key: `driver:${driver.id}`,
    kind: 'driver',
    customerId: driver.linkedCustomerId,
    driverId: driver.id,
    nomComplet: driver.nomComplet,
    telephone: driver.telephone,
    numeroPermis: driver.numeroPermis,
    cinOuPasseport: driver.cinOuPasseport,
    ownerCustomerName: ownerName,
    draft: null,
  };
}

let newCandidateCounter = 0;

export function newDriverCandidate(input: DriverInput): DriverCandidate {
  newCandidateCounter += 1;
  return {
    key: `new:${newCandidateCounter}`,
    kind: 'new',
    customerId: null,
    driverId: null,
    nomComplet: input.nomComplet,
    telephone: input.telephone,
    numeroPermis: input.numeroPermis,
    cinOuPasseport: input.cinOuPasseport,
    ownerCustomerName: null,
    draft: input,
  };
}

/**
 * Candidats proposés à la recherche : tous les clients non archivés + les conducteurs enregistrés
 * qui ne sont pas simplement la ligne technique d'un client (ceux-là passent par la fiche client,
 * pour ne jamais proposer la même personne deux fois).
 */
export function buildDriverCandidates(customers: Customer[], drivers: Driver[]): DriverCandidate[] {
  const ownerName = new Map(customers.map((c) => [c.id, c.nomComplet]));
  const linkedDriverByCustomer = new Map(
    drivers.filter((d) => d.linkedCustomerId).map((d) => [d.linkedCustomerId as string, d.id])
  );

  const fromCustomers = customers
    .filter((c) => !c.archivedAt)
    .map((c) => customerCandidate(c, linkedDriverByCustomer.get(c.id) ?? null));
  const fromDrivers = drivers
    .filter((d) => !d.linkedCustomerId)
    .map((d) => driverCandidate(d, ownerName.get(d.customerId) ?? null));

  return [...fromCustomers, ...fromDrivers];
}

/** Recherche par nom (sans accents ni casse), numéro de téléphone (quel que soit le format) ou numéro de permis. */
export function searchDriverCandidates(candidates: DriverCandidate[], query: string): DriverCandidate[] {
  const text = normalizeText(query);
  if (!text) return candidates;

  const digits = query.replace(/\D+/g, '');
  const searchDigits = digits.length >= 3 ? digits.slice(digits.length >= 10 ? -9 : 0) : '';

  return candidates.filter((candidate) => {
    if (normalizeText(candidate.nomComplet).includes(text)) return true;
    if (searchDigits && canonicalPhone(candidate.telephone).includes(searchDigits)) return true;
    const permis = normalizeId(candidate.numeroPermis);
    return permis !== '' && permis.includes(normalizeId(query));
  });
}

/** Empreintes d'identité : deux candidats qui en partagent une désignent probablement la même personne. */
function identityKeys(candidate: DriverCandidate): string[] {
  const keys = [candidate.key];
  if (candidate.customerId) keys.push(`customer:${candidate.customerId}`);
  if (candidate.driverId) keys.push(`driver:${candidate.driverId}`);
  const phone = canonicalPhone(candidate.telephone);
  if (phone.length === 9) keys.push(`phone:${phone}`);
  const permis = normalizeId(candidate.numeroPermis);
  if (permis) keys.push(`permis:${permis}`);
  const cin = normalizeId(candidate.cinOuPasseport);
  if (cin) keys.push(`id:${cin}`);
  return keys;
}

export function isSamePerson(a: DriverCandidate, b: DriverCandidate): boolean {
  const keysA = new Set(identityKeys(a));
  return identityKeys(b).some((key) => keysA.has(key));
}

/** Candidat représentant un conducteur déjà enregistré (un conducteur lié à un client redevient « le client »). */
export function candidateFromDriver(driver: Driver, customers: Customer[]): DriverCandidate {
  if (driver.linkedCustomerId) {
    const customer = customers.find((c) => c.id === driver.linkedCustomerId);
    if (customer) return customerCandidate(customer, driver.id);
  }
  const owner = customers.find((c) => c.id === driver.customerId);
  return driverCandidate(driver, owner?.nomComplet ?? null);
}
