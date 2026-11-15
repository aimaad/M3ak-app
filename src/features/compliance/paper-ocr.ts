/**
 * Lecture automatique du papier d'assurance ou de visite technique (fonction serveur `scan-document`, clé de l'entreprise : jamais dans l'app).
 * Le résultat PRÉ-REMPLIT le formulaire, il ne l'enregistre jamais : l'employé vérifie puis enregistre.
 *  - un champ illisible ou peu sûr (« low ») reste vide : aucune valeur inventée ;
 *  - ce que l'employé a déjà saisi n'est jamais écrasé ;
 *  - le montant n'est repris que pour ceux qui peuvent le voir (propriétaire, responsable).
 */
import { scanCloudCached } from '@/features/ocr/cached-scan';

import { toDisplayDate, type RenewalDraft } from './logic';
import type { ComplianceKind } from './types';

type Raw = { value?: unknown; confidence?: unknown } | undefined;
const pick = (field: Raw): unknown => (field && field.confidence !== 'low' && field.value != null ? field.value : null);
const text = (field: Raw): string | null => {
  const value = pick(field);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};
const isoDate = (field: Raw): string | null => {
  const value = text(field);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
};

export type PaperFields = {
  validFrom: string | null;
  validUntil: string | null;
  reference: string | null;
  provider: string | null;
  amount: number | null;
  plate: string | null;
  /** Visite technique : le contrôle est-il favorable ? (null = inconnu) */
  favorable: boolean | null;
};

export function normalizePaperFields(raw: unknown): PaperFields {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, Raw>;
  const money = pick(s.montant);
  return {
    validFrom: isoDate(s.dateDebut),
    validUntil: isoDate(s.dateFin),
    reference: text(s.numero),
    provider: text(s.assureur) ?? text(s.centre),
    amount: typeof money === 'number' && Number.isFinite(money) && money >= 0 ? money : null,
    plate: text(s.immatriculation),
    favorable: text(s.resultat) === 'favorable' ? true : text(s.resultat) === 'defavorable' ? false : null,
  };
}

export const hasAnyPaperField = (fields: PaperFields) => !!(fields.validFrom || fields.validUntil || fields.reference || fields.provider || fields.amount !== null);

/** Remplit seulement les champs VIDES du formulaire. */
export function applyPaperFields(draft: RenewalDraft, fields: PaperFields, canSeeAmount: boolean): RenewalDraft {
  return {
    ...draft,
    validFrom: draft.validFrom.trim() ? draft.validFrom : fields.validFrom ? toDisplayDate(fields.validFrom) : draft.validFrom,
    validUntil: draft.validUntil.trim() ? draft.validUntil : fields.validUntil ? toDisplayDate(fields.validUntil) : draft.validUntil,
    reference: draft.reference.trim() ? draft.reference : fields.reference ?? draft.reference,
    provider: draft.provider.trim() ? draft.provider : fields.provider ?? draft.provider,
    amount: !canSeeAmount || draft.amount.trim() || fields.amount === null ? draft.amount : String(fields.amount),
  };
}

/** Le papier semble-t-il concerner un AUTRE véhicule ? Compare les chiffres de la plaque lue avec ceux de la plaque de la fiche. */
export function plateMismatch(readPlate: string | null, vehiclePlate: string): boolean {
  if (!readPlate) return false;
  const digits = (value: string) => value.replace(/\D/g, '');
  const read = digits(readPlate);
  const own = digits(vehiclePlate);
  return read.length >= 3 && own.length >= 3 && !read.includes(own) && !own.includes(read);
}

export type PaperScanResult = { ok: true; fields: PaperFields } | { ok: false; error: string };

export async function scanCompliancePaper(kind: Exclude<ComplianceKind, 'vignette'>, localUri: string, agencyId?: string): Promise<PaperScanResult> {
  const result = await scanCloudCached(kind, localUri, agencyId);
  if (!result.ok) return { ok: false, error: result.error };
  const fields = normalizePaperFields(result.fields);
  return hasAnyPaperField(fields) ? { ok: true, fields } : { ok: false, error: 'nothing_read' };
}

// ------------------------------------------------------------------ gestion du risque (« Fait » rapide)

export type PaperIssue = 'no_dates' | 'other_vehicle' | 'unfavorable' | 'already_expired' | 'not_newer' | 'odd_duration';

export type PaperAssessment = {
  /** Les dates lues peuvent être PROPOSÉES à l'employé (jamais appliquées sans son accord). */
  usable: boolean;
  /** Raisons pour lesquelles les dates du papier ne sont pas proposées. */
  blockers: PaperIssue[];
  /** Avertissements qui n'empêchent pas la proposition mais demandent un contrôle. */
  cautions: PaperIssue[];
  period: { validFrom: string | null; validUntil: string } | null;
  /** N° de police / PV, assureur ou centre, montant : repris seulement si le papier est proposé ET accepté. */
  details: { reference: string | null; provider: string | null; amount: number | null } | null;
  months: number | null;
};

const monthsBetween = (from: string, until: string) => Math.round(((new Date(`${until}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000 / 30.44) * 10) / 10;

/**
 * Peut-on proposer les dates lues comme renouvellement ? Une lecture automatique peut se tromper ou le papier peut être le mauvais : on ne
 * propose les dates que si elles tiennent debout. Dans le doute, les dates proposées par BIBIP restent celles utilisées.
 *  - papier d'un AUTRE véhicule (plaque différente), contrôle technique DÉFAVORABLE, aucune fin lisible : jamais proposé ;
 *  - papier déjà PÉRIMÉ, ou qui ne finit pas APRÈS la période actuelle (probablement l'ancien papier) : jamais proposé ;
 *  - durée inhabituelle (moins d'1 mois, plus de 24) : proposé avec un avertissement.
 */
export function assessPaper(fields: PaperFields, context: { kind: Exclude<ComplianceKind, 'vignette'>; currentUntil: string | null; vehiclePlate: string; today: string }): PaperAssessment {
  const blockers: PaperIssue[] = [];
  const cautions: PaperIssue[] = [];
  if (plateMismatch(fields.plate, context.vehiclePlate)) blockers.push('other_vehicle');
  if (context.kind === 'visite_technique' && fields.favorable === false) blockers.push('unfavorable');
  if (!fields.validUntil) blockers.push('no_dates');
  else {
    if (fields.validUntil < context.today) blockers.push('already_expired');
    else if (context.currentUntil && fields.validUntil <= context.currentUntil) blockers.push('not_newer');
  }
  const months = fields.validFrom && fields.validUntil ? monthsBetween(fields.validFrom, fields.validUntil) : null;
  if (months !== null && (months < 1 || months > 24)) cautions.push('odd_duration');
  const usable = blockers.length === 0;
  return {
    usable,
    blockers,
    cautions,
    period: usable && fields.validUntil ? { validFrom: fields.validFrom, validUntil: fields.validUntil } : null,
    details: usable ? { reference: fields.reference, provider: fields.provider, amount: fields.amount } : null,
    months,
  };
}
