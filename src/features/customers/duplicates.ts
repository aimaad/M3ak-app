import type { Customer } from './types';

/**
 * +212661234567 et 0661234567 désignent le même numéro : on compare les 9
 * derniers chiffres (numéro national marocain sans indicatif ni "0" initial).
 */
function canonicalPhone(raw: string): string {
  const digits = raw.replace(/\D+/g, '');
  return digits.slice(-9);
}

/**
 * Doublons potentiels : même téléphone (quel que soit le format) OU même
 * CIN/passeport (insensible à la casse et aux espaces). Ne fusionne jamais
 * automatiquement — on se contente de signaler les correspondances pour
 * qu'un humain décide.
 */
export function findPotentialDuplicates(
  customers: Customer[],
  candidate: { telephone?: string | null; cinOuPasseport?: string | null },
  excludeId?: string
): Customer[] {
  const phone = candidate.telephone ? canonicalPhone(candidate.telephone) : '';
  const cin = candidate.cinOuPasseport?.trim().toLowerCase() ?? '';

  if (!phone && !cin) return [];

  return customers.filter((customer) => {
    if (customer.id === excludeId) return false;
    const samePhone = !!phone && !!customer.telephone && canonicalPhone(customer.telephone) === phone;
    const sameCin = !!cin && !!customer.cinOuPasseport && customer.cinOuPasseport.trim().toLowerCase() === cin;
    return samePhone || sameCin;
  });
}

export type DuplicateReason = 'phone' | 'identity_document' | 'licence_number' | 'name_and_birth';
export type DuplicateMatch = { customer: Customer; reasons: DuplicateReason[] };

/** Numéro de permis comparé sans espaces, barres ni tirets : « 12/345678 » = « 12 345678 ». */
export function normalizeLicenceNumber(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function normalizeName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Clients qui ressemblent à celui qu'on saisit, avec la RAISON de la ressemblance (téléphone, pièce d'identité,
 * numéro de permis — y compris celui d'un document de permis enregistré —, ou même nom et même date de naissance).
 * Ne fusionne ni ne bloque jamais : l'employé décide.
 */
export function findDuplicateMatches(
  customers: Customer[],
  candidate: {
    telephone?: string | null;
    cinOuPasseport?: string | null;
    numeroPermis?: string | null;
    nomComplet?: string | null;
    dateNaissance?: string | null;
  },
  excludeId?: string
): DuplicateMatch[] {
  const phone = candidate.telephone ? canonicalPhone(candidate.telephone) : '';
  const cin = candidate.cinOuPasseport?.trim().toLowerCase() ?? '';
  const licence = candidate.numeroPermis ? normalizeLicenceNumber(candidate.numeroPermis) : '';
  const name = candidate.nomComplet ? normalizeName(candidate.nomComplet) : '';
  const birth = candidate.dateNaissance?.trim() ?? '';

  const matches: DuplicateMatch[] = [];
  for (const customer of customers) {
    if (customer.id === excludeId) continue;
    const reasons: DuplicateReason[] = [];

    if (phone && customer.telephone && canonicalPhone(customer.telephone) === phone) reasons.push('phone');
    if (cin && customer.cinOuPasseport && customer.cinOuPasseport.trim().toLowerCase() === cin) reasons.push('identity_document');
    if (licence.length >= 4) {
      const known = [customer.numeroPermis, ...customer.documents.filter((d) => d.type === 'permis').map((d) => d.reference)];
      if (known.some((n) => n && normalizeLicenceNumber(n) === licence)) reasons.push('licence_number');
    }
    if (name && birth && customer.dateNaissance === birth && normalizeName(customer.nomComplet) === name) {
      reasons.push('name_and_birth');
    }
    if (reasons.length > 0) matches.push({ customer, reasons });
  }
  return matches;
}
