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
