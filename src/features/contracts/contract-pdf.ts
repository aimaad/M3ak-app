import * as Print from 'expo-print';

import type { HandwrittenSignature } from '@/features/signatures/signature';

import { defaultContractTemplate } from './default-template';
import { ensureSignatures, parseTemplate, type ContractTemplate, type TemplateContext, type TemplateValues } from './template';
import { renderTemplateHtml } from './template-render';
import type { Contract } from './types';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Champs strictement nécessaires pour générer un contrat lisible. Si l'un
 * d'eux manque, on refuse de générer un document présenté comme définitif
 * (voir buildContractHtml -> assertContractIsComplete).
 */
export function assertContractIsComplete(contract: Contract, agencyName: string): string[] {
  const missing: string[] = [];
  if (!agencyName.trim()) missing.push('nom de l’agence');
  if (!contract.customerNom.trim()) missing.push('nom du client');
  if (!contract.vehicleImmatriculation.trim()) missing.push('immatriculation du véhicule');
  if (!contract.dateDebutPrevue) missing.push('date de départ');
  if (!contract.dateFinPrevue) missing.push('date de retour');
  if (contract.prixTotal == null) missing.push('prix total');
  return missing;
}

export type ContractAgencyInfo = {
  nom: string;
  raisonSociale?: string | null;
  adresse?: string | null;
  ville?: string | null;
  telephone?: string | null;
  email?: string | null;
};

export type ContractSignatures = {
  client?: HandwrittenSignature | null;
  agency?: HandwrittenSignature | null;
  /** Cachet de l'agence en data URI (png/jpeg uniquement ; toute autre valeur est ignorée). */
  stampDataUri?: string | null;
  /** Logo de l'agence en data URI (png/jpeg uniquement). */
  logoDataUri?: string | null;
  /** Nom de la personne de l'agence qui signe. */
  agencySignerName?: string | null;
};

const CONDITION_LABEL: Record<string, string> = { bon: 'Bon état', moyen: 'État moyen', mauvais: 'Mauvais état' };
const ACCESSORY_LABEL: Record<string, string> = {
  roue_secours: 'Roue de secours',
  triangle_gilet: 'Triangle + gilet',
  cric: 'Cric',
  extincteur: 'Extincteur',
  autoradio_gps: 'Autoradio / GPS',
  chargeur: 'Chargeur',
  carte_grise_vehicule: 'Carte grise',
  assurance_vehicule: "Attestation d'assurance",
};

const money = (value: number) => `${value.toLocaleString('fr-FR')} MAD`;

/** Valeurs des champs automatiques ({{client_nom}}…) à partir du contrat figé et de la fiche agence. */
export function contractTemplateValues(contract: Contract, info: ContractAgencyInfo): TemplateValues {
  return {
    numero: contract.numero,
    date_contrat: formatDateTime(contract.createdAt),
    ville_contrat: info.ville ?? '',
    agence_nom: info.nom,
    agence_raison_sociale: info.raisonSociale ?? '',
    agence_adresse: info.adresse ?? '',
    agence_ville: info.ville ?? '',
    agence_telephone: info.telephone ?? '',
    agence_email: info.email ?? '',
    client_nom: contract.customerNom,
    client_cin: contract.customerCin ?? '',
    client_telephone: contract.customerTelephone ?? '',
    conducteur_principal: contract.driverNom ?? '',
    autres_conducteurs: contract.autresConducteurs.join('\n'),
    vehicule: `${contract.vehicleMarque} ${contract.vehicleModele} (${contract.vehicleImmatriculation})`,
    marque: contract.vehicleMarque,
    modele: contract.vehicleModele,
    immatriculation: contract.vehicleImmatriculation,
    date_debut: formatDateTime(contract.dateDebutPrevue),
    date_fin: formatDateTime(contract.dateFinPrevue),
    prix_total: contract.prixTotal != null ? money(contract.prixTotal) : '',
    caution: money(contract.cautionMontant),
    etat_depart: contract.etatDepart ? (CONDITION_LABEL[contract.etatDepart] ?? '') : '',
    accessoires_depart: contract.accessoiresDepart.map((key) => ACCESSORY_LABEL[key] ?? key).join(', '),
    observations_depart: contract.observationsDepart ?? '',
    conditions_particulieres: contract.conditionsParticulieres ?? '',
  };
}

export function contractTemplateContext(contract: Contract): TemplateContext {
  return {
    hasDrivers: !!contract.driverNom || contract.autresConducteurs.length > 0,
    hasConditions: !!contract.conditionsParticulieres,
    hasDeparture: !!contract.etatDepart,
  };
}

/**
 * Modèle à utiliser : celui figé sur le contrat s'il est signé, sinon celui de l'agence, sinon le modèle M3ak standard.
 * Un modèle illisible ou invalide retombe sur le standard (jamais d'erreur au moment de générer un contrat).
 */
export function resolveTemplate(contract: Contract, info: ContractAgencyInfo, agencyTemplate?: unknown): ContractTemplate {
  const custom = parseTemplate(contract.termsSnapshot ?? agencyTemplate ?? null);
  if (custom) return ensureSignatures(custom);
  const agencyLines = [
    info.nom + (info.raisonSociale && info.raisonSociale !== info.nom ? ` — ${info.raisonSociale}` : ''),
    [info.adresse, info.ville].filter(Boolean).join(', '),
    [info.telephone ? `Tél : ${info.telephone}` : '', info.email ?? ''].filter(Boolean).join(' · '),
  ].filter(Boolean);
  return defaultContractTemplate({ caution: money(contract.cautionMontant), city: info.ville ?? '', agencyLines });
}

/** Remplit le modèle (instantané : aucun appel réseau ni IA). */
export function buildContractHtml(
  contract: Contract,
  agency: string | ContractAgencyInfo,
  signatures: ContractSignatures = {},
  agencyTemplate?: unknown
): string {
  const info: ContractAgencyInfo = typeof agency === 'string' ? { nom: agency } : agency;
  return renderTemplateHtml(resolveTemplate(contract, info, agencyTemplate), {
    values: contractTemplateValues(contract, info),
    context: contractTemplateContext(contract),
    clientName: contract.customerNom,
    agencyName: info.nom,
    agencySignerName: signatures.agencySignerName,
    clientSignedAtLabel: contract.clientSignedAt ? formatDateTime(contract.clientSignedAt) : null,
    agencySignedAtLabel: contract.signedAt ? formatDateTime(contract.signedAt) : null,
    signatures: { client: signatures.client, agency: signatures.agency },
    stampDataUri: signatures.stampDataUri,
    logoDataUri: signatures.logoDataUri,
  });
}

export async function generateContractPdf(
  contract: Contract,
  agency: string | ContractAgencyInfo,
  signatures: ContractSignatures = {},
  agencyTemplate?: unknown
): Promise<string> {
  const missing = assertContractIsComplete(contract, typeof agency === 'string' ? agency : agency.nom);
  if (missing.length > 0) {
    throw new Error(`Informations manquantes pour générer le contrat : ${missing.join(', ')}`);
  }

  const html = buildContractHtml(contract, agency, signatures, agencyTemplate);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}
