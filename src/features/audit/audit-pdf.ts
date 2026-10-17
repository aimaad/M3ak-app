import * as Print from 'expo-print';

import { actorLabel, describeAuditEntry } from './describe';
import type { AuditEntry } from './types';

type T = (key: string, params?: Record<string, unknown>) => string;

/** Échappement complet : noms d'employés, de clients et de véhicules viennent de la base et ne doivent jamais être interprétés comme du HTML. */
export function escapeHtml(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const dateTime = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export type AuditPdfInput = {
  agencyName: string;
  entries: AuditEntry[];
  truncated: boolean;
  /** Intitulés des filtres actifs, déjà traduits (période, employé, catégorie). */
  filterLabels: string[];
  generatedBy: string;
  generatedAt: Date;
  language: 'fr' | 'ar';
  t: T;
};

/** Document de traçabilité : en-tête (entreprise, filtres, date, auteur de l'export), tableau chronologique, mention de confidentialité. */
export function buildAuditHtml(input: AuditPdfInput): string {
  const { t, language } = input;
  const locale = language === 'ar' ? 'ar' : 'fr-FR';
  const rows = input.entries
    .map(
      (entry) => `
        <tr>
          <td class="nowrap">${escapeHtml(dateTime(entry.createdAt, locale))}</td>
          <td>${escapeHtml(actorLabel(entry, t))}${entry.actorRole ? `<div class="muted">${escapeHtml(t(`equipe.roles.${entry.actorRole}`))}</div>` : ''}</td>
          <td>${escapeHtml(describeAuditEntry(entry, t))}</td>
        </tr>`
    )
    .join('');

  return `<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Helvetica, Arial, sans-serif; color: #211A2E; padding: 24px; }
      h1 { font-size: 20px; margin: 0 0 4px; color: #5B21B6; }
      .meta { color: #81778F; font-size: 12px; margin-bottom: 14px; line-height: 1.6; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { text-align: start; background: #EDE9FE; padding: 6px; }
      td { padding: 6px; border-bottom: 1px solid #EAE5F2; vertical-align: top; }
      .nowrap { white-space: nowrap; }
      .muted { color: #81778F; font-size: 10px; }
      .warn { margin-top: 10px; padding: 8px; background: #FEF3C7; color: #78350F; font-size: 11px; }
      .footer { margin-top: 18px; color: #81778F; font-size: 10px; }
    </style>
  </head>
  <body dir="${language === 'ar' ? 'rtl' : 'ltr'}">
    <h1>${escapeHtml(t('journal.pdf.title'))}</h1>
    <div class="meta">
      <div>${escapeHtml(input.agencyName)}</div>
      <div>${escapeHtml(t('journal.pdf.filters'))} : ${escapeHtml(input.filterLabels.join(' · '))}</div>
      <div>${escapeHtml(t('journal.pdf.generated', { date: dateTime(input.generatedAt.toISOString(), locale), by: input.generatedBy }))}</div>
      <div>${escapeHtml(t('journal.pdf.count', { count: input.entries.length }))}</div>
    </div>
    <table>
      <thead><tr><th>${escapeHtml(t('journal.pdf.date'))}</th><th>${escapeHtml(t('journal.pdf.employee'))}</th><th>${escapeHtml(t('journal.pdf.action'))}</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="3">${escapeHtml(t('journal.empty'))}</td></tr>`}</tbody>
    </table>
    ${input.truncated ? `<div class="warn">${escapeHtml(t('journal.pdf.truncated'))}</div>` : ''}
    <div class="footer">${escapeHtml(t('journal.pdf.confidential'))}</div>
  </body>
</html>`;
}

export async function generateAuditPdf(input: AuditPdfInput): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html: buildAuditHtml(input), base64: false });
  return uri;
}
