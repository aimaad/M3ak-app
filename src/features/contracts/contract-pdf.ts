import * as Print from 'expo-print';

import { signatureToSvg, type HandwrittenSignature } from '@/features/signatures/signature';

import { CONTRACT_ACCEPTANCE, contractArticles } from './contract-terms';
import type { Contract } from './types';

function escapeHtml(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

function row(labelFr: string, labelAr: string, value: string): string {
  return `<tr><td class="label">${escapeHtml(labelFr)}<span class="ar"> · ${escapeHtml(labelAr)}</span></td><td>${value}</td></tr>`;
}

const STAMP_PATTERN = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

function signatureBlock(
  titleFr: string,
  titleAr: string,
  signature: HandwrittenSignature | null | undefined,
  name: string | null | undefined,
  when: string | null | undefined,
  stampDataUri?: string | null
): string {
  const svg = signature ? signatureToSvg(signature, 70) : '';
  const stamp = stampDataUri && STAMP_PATTERN.test(stampDataUri) ? `<img class="stamp" src="${stampDataUri}" />` : '';
  return `<div class="sign-box">
    <div class="sign-title">${escapeHtml(titleFr)} <span class="ar">· ${escapeHtml(titleAr)}</span></div>
    <div class="sign-area">${svg}${stamp}</div>
    ${name ? `<div class="sign-name">${escapeHtml(name)}</div>` : ''}
    ${when ? `<div class="sign-date">${escapeHtml(when)}</div>` : ''}
  </div>`;
}

export function buildContractHtml(contract: Contract, agency: string | ContractAgencyInfo, signatures: ContractSignatures = {}): string {
  const info: ContractAgencyInfo = typeof agency === 'string' ? { nom: agency } : agency;
  const articles = contractArticles({ caution: money(contract.cautionMontant), city: info.ville ?? '' });
  const hasDrivers = !!contract.driverNom || contract.autresConducteurs.length > 0;
  const agencyAddress = [info.adresse, info.ville].filter(Boolean).join(', ');
  const hasDepartureInspection = !!contract.etatDepart;

  const articleRows = articles
    .map(
      (article, index) => `
      <tr class="article">
        <td class="fr"><b>Article ${index + 1} — ${escapeHtml(article.fr.title)}</b><br />${escapeHtml(article.fr.body)}</td>
        <td class="ar-col" dir="rtl"><b>المادة ${index + 1} — ${escapeHtml(article.ar.title)}</b><br />${escapeHtml(article.ar.body)}</td>
      </tr>`
    )
    .join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Helvetica, Arial, sans-serif; color: #211A2E; padding: 24px; font-size: 12px; }
          h1 { font-size: 20px; margin: 0 0 2px; }
          h2 { font-size: 14px; margin: 22px 0 4px; border-bottom: 1px solid #EAE5F2; padding-bottom: 4px; }
          .ref { color: #81778F; font-size: 12px; margin-bottom: 12px; }
          .agency { color: #211A2E; font-size: 12px; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          td { padding: 4px 0; font-size: 12px; vertical-align: top; }
          td.label { color: #81778F; width: 42%; }
          .ar { color: #81778F; }
          .terms td { width: 50%; padding: 6px 8px; border-bottom: 1px solid #EAE5F2; font-size: 10px; line-height: 1.45; }
          .terms td.ar-col { text-align: right; }
          .accept { margin-top: 14px; font-size: 11px; line-height: 1.5; }
          .signatures { margin-top: 26px; display: flex; justify-content: space-between; gap: 24px; page-break-inside: avoid; }
          .sign-box { width: 47%; border: 1px solid #EAE5F2; border-radius: 6px; padding: 8px; font-size: 11px; text-align: center; }
          .sign-title { font-weight: bold; }
          .sign-area { height: 76px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #211A2E; margin: 6px 0 4px; }
          .stamp { height: 70px; max-width: 110px; object-fit: contain; margin-inline-start: 8px; }
          .sign-name { font-weight: bold; }
          .sign-date { color: #81778F; font-size: 10px; }
          .notice { margin-top: 20px; font-size: 9px; color: #B3A6C2; border-top: 1px solid #EAE5F2; padding-top: 8px; }
        </style>
      </head>
      <body>
        <h1>Contrat de location de véhicule <span class="ar">· عقد كراء سيارة</span></h1>
        <div class="ref">N° ${escapeHtml(contract.numero)}</div>

        <h2>Le loueur (l'Agence) <span class="ar">· المكري (الوكالة)</span></h2>
        <div class="agency">
          <b>${escapeHtml(info.nom)}</b>${info.raisonSociale && info.raisonSociale !== info.nom ? ` — ${escapeHtml(info.raisonSociale)}` : ''}<br />
          ${agencyAddress ? `${escapeHtml(agencyAddress)}<br />` : ''}
          ${info.telephone ? `Tél : ${escapeHtml(info.telephone)}` : ''}${info.telephone && info.email ? ' · ' : ''}${info.email ? escapeHtml(info.email) : ''}
        </div>

        <h2>Le locataire${hasDrivers ? ' et conducteurs' : ''} <span class="ar">· المكتري${hasDrivers ? ' والسائقون' : ''}</span></h2>
        <table>
          ${row('Client', 'الزبون', escapeHtml(contract.customerNom))}
          ${contract.customerCin ? row('CIN / Passeport', 'البطاقة / الجواز', escapeHtml(contract.customerCin)) : ''}
          ${contract.customerTelephone ? row('Téléphone', 'الهاتف', escapeHtml(contract.customerTelephone)) : ''}
          ${contract.driverNom ? row('Conducteur principal', 'السائق الرئيسي', escapeHtml(contract.driverNom)) : ''}
          ${
            contract.autresConducteurs.length > 0
              ? row('Conducteurs supplémentaires', 'سائقون إضافيون', contract.autresConducteurs.map((name) => escapeHtml(name)).join('<br />'))
              : ''
          }
        </table>

        <h2>Le véhicule <span class="ar">· السيارة</span></h2>
        <table>
          ${row('Marque / modèle', 'العلامة / الطراز', `${escapeHtml(contract.vehicleMarque)} ${escapeHtml(contract.vehicleModele)}`)}
          ${row('Immatriculation', 'رقم التسجيل', escapeHtml(contract.vehicleImmatriculation))}
        </table>

        <h2>Période et tarif <span class="ar">· المدة والثمن</span></h2>
        <table>
          ${row('Départ prévu', 'الانطلاق', formatDateTime(contract.dateDebutPrevue))}
          ${row('Retour prévu', 'الإرجاع', formatDateTime(contract.dateFinPrevue))}
          ${row('Prix total', 'الثمن الإجمالي', contract.prixTotal != null ? money(contract.prixTotal) : '—')}
          ${row('Caution', 'الضمانة', money(contract.cautionMontant))}
        </table>

        ${
          hasDepartureInspection
            ? `<h2>État des lieux au départ <span class="ar">· معاينة الانطلاق</span></h2>
        <table>
          ${row('État général', 'الحالة العامة', escapeHtml(CONDITION_LABEL[contract.etatDepart as string] ?? ''))}
          ${row('Accessoires remis', 'الملحقات المسلمة', contract.accessoiresDepart.length > 0 ? contract.accessoiresDepart.map((key) => escapeHtml(ACCESSORY_LABEL[key] ?? key)).join(', ') : '—')}
          ${contract.observationsDepart ? row('Observations', 'ملاحظات', escapeHtml(contract.observationsDepart)) : ''}
        </table>`
            : ''
        }

        ${
          contract.conditionsParticulieres
            ? `<h2>Conditions particulières <span class="ar">· شروط خاصة</span></h2><table><tr><td>${escapeHtml(contract.conditionsParticulieres)}</td></tr></table>`
            : ''
        }

        <h2>Conditions générales <span class="ar">· الشروط العامة</span></h2>
        <table class="terms">${articleRows}</table>

        <p class="accept">${escapeHtml(CONTRACT_ACCEPTANCE.fr)}<br /><span dir="rtl">${escapeHtml(CONTRACT_ACCEPTANCE.ar)}</span></p>

        <div class="signatures">
          ${signatureBlock('Le locataire', 'المكتري', signatures.client, contract.customerNom, contract.clientSignedAt ? formatDateTime(contract.clientSignedAt) : null)}
          ${signatureBlock("Pour l'agence", 'عن الوكالة', signatures.agency, signatures.agencySignerName ?? info.nom, contract.signedAt ? formatDateTime(contract.signedAt) : null, signatures.stampDataUri)}
        </div>

        <p class="notice">
          Document généré par M3ak. Les conditions générales sont un modèle standard : l'agence doit s'assurer
          de leur conformité à la réglementation applicable avant tout usage commercial.
        </p>
      </body>
    </html>
  `;
}

export async function generateContractPdf(contract: Contract, agency: string | ContractAgencyInfo, signatures: ContractSignatures = {}): Promise<string> {
  const missing = assertContractIsComplete(contract, typeof agency === 'string' ? agency : agency.nom);
  if (missing.length > 0) {
    throw new Error(`Informations manquantes pour générer le contrat : ${missing.join(', ')}`);
  }

  const html = buildContractHtml(contract, agency, signatures);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}
