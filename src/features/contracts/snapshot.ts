import type { Customer, CustomerDocument, Driver } from '@/features/customers/types';

import type { Placeholder } from './template';

export type SnapshotValues = Partial<Record<Placeholder, string>>;

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const firstDoc = (customer: Customer, type: CustomerDocument['type']): CustomerDocument | undefined =>
  customer.documents.find((doc) => doc.type === type);

/**
 * Informations du client et du deuxième conducteur, figées sur le contrat à sa création : une modification ultérieure
 * de la fiche client ne change jamais un contrat existant. Les valeurs absentes restent vides (ligne à remplir à la main).
 */
export function buildSnapshotValues(customer: Customer, additionalDrivers: Pick<Driver, 'nomComplet' | 'prenom' | 'nom' | 'cinOuPasseport' | 'numeroPermis'>[]): SnapshotValues {
  const licence = firstDoc(customer, 'permis');
  const passport = firstDoc(customer, 'passeport');
  const identityCard = firstDoc(customer, 'cin');
  const second = additionalDrivers[0];
  const hasSplitName = !!(customer.prenom || customer.nom);

  const values: SnapshotValues = {
    client_prenom: customer.prenom ?? '',
    client_nom_famille: hasSplitName ? (customer.nom ?? '') : customer.nomComplet,
    client_naissance: formatDate(customer.dateNaissance),
    client_nationalite: customer.pays ?? '',
    client_adresse: [customer.adresse, customer.ville].filter(Boolean).join(', '),
    client_permis: licence?.reference ?? customer.numeroPermis ?? '',
    client_permis_delivre_le: formatDate(licence?.dateDelivrance),
    client_permis_delivre_a: licence?.issuingAuthority ?? '',
    // Le numéro de CIN vient de la fiche, sinon du document « CIN » du dossier.
    client_cin: customer.cinOuPasseport ?? identityCard?.reference ?? '',
    client_passeport: passport?.reference ?? '',
    // Conducteur créé avant l'ajout du prénom : le nom complet va dans « Nom », « Prénom » reste à écrire à la main.
    conducteur2_prenom: second?.prenom ?? '',
    conducteur2_nom: second ? (second.prenom || second.nom ? (second.nom ?? '') : second.nomComplet) : '',
    conducteur2_permis: second?.numeroPermis ?? '',
    conducteur2_cin: second?.cinOuPasseport ?? '',
  };
  return Object.fromEntries(Object.entries(values).filter(([, value]) => typeof value === 'string' && value.trim() !== '')) as SnapshotValues;
}

/**
 * Relevés et dommages de l'inspection de départ, figés dans le contrat à sa création : kilométrage et carburant lus
 * à l'inspection, dommages que l'employé a choisi d'inscrire, et ce qu'il a écrit à la main.
 */
export function departureSnapshotValues(input: { km: number | null; carburant: number | null; damages: string[]; written: string }): SnapshotValues {
  const damages = [...input.damages, input.written.trim()].filter(Boolean).join('\n');
  const values: SnapshotValues = {
    ...(input.km != null ? { km_depart: String(input.km) } : {}),
    ...(input.carburant != null ? { carburant_depart: `${input.carburant} %` } : {}),
    ...(damages ? { dommages_depart: damages.slice(0, 2000) } : {}),
    // Copie du texte écrit à la main, pour le retrouver tel quel quand on corrige le contrat.
    ...(input.written.trim() ? { dommages_ecrits_depart: input.written.trim().slice(0, 2000) } : {}),
  };
  return values;
}
