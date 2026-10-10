import * as Print from 'expo-print';

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

export function buildContractHtml(contract: Contract, agencyName: string): string {
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Helvetica, Arial, sans-serif; color: #211A2E; padding: 24px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          h2 { font-size: 14px; margin-top: 24px; border-bottom: 1px solid #EAE5F2; padding-bottom: 4px; }
          .ref { color: #81778F; font-size: 12px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          td { padding: 4px 0; font-size: 13px; vertical-align: top; }
          td.label { color: #81778F; width: 45%; }
          .notice { margin-top: 32px; font-size: 10px; color: #B3A6C2; border-top: 1px solid #EAE5F2; padding-top: 12px; }
          .signatures { margin-top: 48px; display: flex; justify-content: space-between; }
          .sign-box { width: 45%; border-top: 1px solid #211A2E; padding-top: 4px; font-size: 12px; text-align: center; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(agencyName)}</h1>
        <div class="ref">Contrat de location N° ${escapeHtml(contract.numero)}</div>

        <h2>Véhicule</h2>
        <table>
          <tr><td class="label">Marque / modèle</td><td>${escapeHtml(contract.vehicleMarque)} ${escapeHtml(contract.vehicleModele)}</td></tr>
          <tr><td class="label">Immatriculation</td><td>${escapeHtml(contract.vehicleImmatriculation)}</td></tr>
        </table>

        <h2>Client${contract.driverNom ? ' et conducteur' : ''}</h2>
        <table>
          <tr><td class="label">Client</td><td>${escapeHtml(contract.customerNom)}</td></tr>
          ${contract.customerTelephone ? `<tr><td class="label">Téléphone</td><td>${escapeHtml(contract.customerTelephone)}</td></tr>` : ''}
          ${contract.customerCin ? `<tr><td class="label">CIN / Passeport</td><td>${escapeHtml(contract.customerCin)}</td></tr>` : ''}
          ${contract.driverNom ? `<tr><td class="label">Conducteur principal</td><td>${escapeHtml(contract.driverNom)}</td></tr>` : ''}
        </table>

        <h2>Période et tarif</h2>
        <table>
          <tr><td class="label">Départ prévu</td><td>${formatDateTime(contract.dateDebutPrevue)}</td></tr>
          <tr><td class="label">Retour prévu</td><td>${formatDateTime(contract.dateFinPrevue)}</td></tr>
          <tr><td class="label">Prix total</td><td>${contract.prixTotal != null ? `${contract.prixTotal.toLocaleString('fr-FR')} MAD` : '—'}</td></tr>
          <tr><td class="label">Caution</td><td>${contract.cautionMontant.toLocaleString('fr-FR')} MAD</td></tr>
        </table>

        ${
          contract.conditionsParticulieres
            ? `<h2>Conditions particulières</h2><table><tr><td>${escapeHtml(contract.conditionsParticulieres)}</td></tr></table>`
            : ''
        }

        <p class="notice">
          Document généré automatiquement par M3ak à titre d'information contractuelle. Ce modèle
          n'a pas été validé juridiquement : vérifiez sa conformité aux exigences réglementaires
          applicables avant toute utilisation commerciale.
        </p>

        <div class="signatures">
          <div class="sign-box">Signature du client</div>
          <div class="sign-box">Signature de l'agence</div>
        </div>
      </body>
    </html>
  `;
}

export async function generateContractPdf(contract: Contract, agencyName: string): Promise<string> {
  const missing = assertContractIsComplete(contract, agencyName);
  if (missing.length > 0) {
    throw new Error(`Informations manquantes pour générer le contrat : ${missing.join(', ')}`);
  }

  const html = buildContractHtml(contract, agencyName);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}
