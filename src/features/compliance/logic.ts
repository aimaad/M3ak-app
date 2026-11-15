/**
 * Obligations d'un véhicule (assurance, visite technique, vignette) : période en cours, état du jour, suggestion de renouvellement,
 * validation d'un renouvellement et avertissements avant une location. Fonctions pures : « maintenant » est un paramètre.
 *
 * Règles de dates : `validUntil` est le DERNIER jour couvert. Une obligation qui se termine aujourd'hui est donc encore valable
 * (« expire aujourd'hui ») ; elle est expirée dès demain. Aucun délai de tolérance : il n'en existe pas pour l'assurance.
 */
import { parseFrDate } from '@/features/audit/types';

import { COMPLIANCE_KINDS, type ComplianceInput, type ComplianceKind, type ComplianceRecord, type ComplianceSettings } from './types';

const MS_PER_DAY = 86_400_000;
export const SOON_DAYS = 30;
export const URGENT_DAYS = 7;

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDay = (key: string) => {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Jours entre aujourd'hui et un jour AAAA-MM-JJ : 0 = aujourd'hui, négatif = passé. */
export const daysUntil = (key: string, now: Date) => Math.round((parseDay(key).getTime() - startOfDay(now).getTime()) / MS_PER_DAY);

/** Ajoute des mois sans déborder (31 janvier + 1 mois = 28 février). */
export function addMonths(key: string, months: number): string {
  const base = parseDay(key);
  const target = new Date(base.getFullYear(), base.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(base.getDate(), lastDay));
  return dayKey(target);
}

export const addDays = (key: string, days: number) => dayKey(new Date(parseDay(key).getFullYear(), parseDay(key).getMonth(), parseDay(key).getDate() + days));

// ------------------------------------------------------------------ période en cours et historique

/** La période EN COURS : celle dont la fin est la plus lointaine. Null si aucune. */
export function currentRecord(records: ComplianceRecord[], kind: ComplianceKind): ComplianceRecord | null {
  return records.filter((record) => record.kind === kind).reduce<ComplianceRecord | null>((best, record) => (!best || record.validUntil > best.validUntil ? record : best), null);
}

/** Historique d'un type, de la période la plus récente à la plus ancienne. */
export const historyOf = (records: ComplianceRecord[], kind: ComplianceKind) =>
  records.filter((record) => record.kind === kind).sort((a, b) => b.validUntil.localeCompare(a.validUntil) || b.createdAt.localeCompare(a.createdAt));

// ------------------------------------------------------------------ état du jour

/** Une période a COMMENCÉ au jour donné (début inconnu = commencée : anciennes données). */
const startedBy = (record: ComplianceRecord, day: string) => !record.validFrom || record.validFrom <= day;

/**
 * Ce qui couvre RÉELLEMENT un jour donné (jamais « la période qui finit le plus tard », qui peut ne pas avoir commencé) :
 *  - `covering` : la période qui couvre ce jour (commencée, pas finie) ;
 *  - `chainEnd` : la fin de la couverture continue, si des périodes suivantes s'enchaînent sans trou (renouvellement fait à l'avance) ;
 *  - `past` : la dernière période déjà terminée ; `upcoming` : la première période pas encore commencée.
 */
export function coverageAt(records: ComplianceRecord[], kind: ComplianceKind, day: string): { covering: ComplianceRecord | null; chainEnd: string | null; past: ComplianceRecord | null; upcoming: ComplianceRecord | null } {
  const own = records.filter((record) => record.kind === kind);
  const covering = own.filter((record) => startedBy(record, day) && record.validUntil >= day).reduce<ComplianceRecord | null>((best, record) => (!best || record.validUntil > best.validUntil ? record : best), null);
  let chainEnd: string | null = covering ? covering.validUntil : null;
  while (chainEnd) {
    const end: string = chainEnd;
    const next = own.filter((record) => record.validUntil > end && (!record.validFrom || record.validFrom <= addDays(end, 1))).reduce<ComplianceRecord | null>((best, record) => (!best || record.validUntil > best.validUntil ? record : best), null);
    if (!next) break;
    chainEnd = next.validUntil;
  }
  const past = own.filter((record) => record.validUntil < day).reduce<ComplianceRecord | null>((best, record) => (!best || record.validUntil > best.validUntil ? record : best), null);
  const upcoming = own.filter((record) => record.validFrom && record.validFrom > day).reduce<ComplianceRecord | null>((best, record) => (!best || (record.validFrom as string) < (best.validFrom as string) ? record : best), null);
  return { covering, chainEnd, past, upcoming };
}

/** Position d'une période par rapport à aujourd'hui. */
export function periodPhase(record: ComplianceRecord, now: Date): 'current' | 'upcoming' | 'ended' {
  const today = dayKey(now);
  if (record.validUntil < today) return 'ended';
  return startedBy(record, today) ? 'current' : 'upcoming';
}

export type ComplianceState = 'none' | 'valid' | 'soon' | 'urgent' | 'expired';
export type ComplianceStatus = {
  kind: ComplianceKind;
  state: ComplianceState;
  record: ComplianceRecord | null;
  /** Jours avant la fin de la période (ou avant la date limite de la vignette) ; négatif = dépassé ; null = rien d'enregistré. */
  days: number | null;
  /** Date de référence affichée : fin de période, ou date limite attendue pour une vignette. */
  due: string | null;
  /** Vignette : date limite de paiement (31 janvier) plutôt qu'une fin de validité. */
  isDeadline: boolean;
  /** Des périodes suivantes s'enchaînent : la couverture continue jusqu'à cette date (renouvellement fait à l'avance). */
  renewedUntil?: string | null;
  /** Début de la prochaine période pas encore commencée (utile quand il y a un trou de couverture). */
  upcomingFrom?: string | null;
  /** Aucune période ne couvre aujourd'hui alors que des périodes existent (toutes passées ou toutes à venir). */
  uncovered?: boolean;
};

const stateOf = (days: number): ComplianceState => (days < 0 ? 'expired' : days <= URGENT_DAYS ? 'urgent' : days <= SOON_DAYS ? 'soon' : 'valid');

/**
 * Vignette : couvre l'année civile ; à payer avant le 31 janvier de l'année (60 jours après la mise en circulation pour un véhicule mis
 * en circulation dans l'année). Rien n'est enregistré : état « non renseigné » (on ne peut pas affirmer qu'elle manque : les véhicules
 * déjà dans l'application n'ont aucun historique). La période en cours couvre l'année : à jour, prochaine date limite = 31 janvier suivant.
 * Elle ne couvre plus l'année en cours : la date limite est le 31 janvier de cette année, puis « expirée ».
 */
function vignetteStatus(records: ComplianceRecord[], vehicle: { dateMiseEnCirculation?: string | null }, now: Date): ComplianceStatus {
  const record = currentRecord(records, 'vignette');
  const year = now.getFullYear();
  if (!record) {
    const registered = vehicle.dateMiseEnCirculation && /^\d{4}-\d{2}-\d{2}/.test(vehicle.dateMiseEnCirculation) ? vehicle.dateMiseEnCirculation.slice(0, 10) : null;
    const deadline = registered && registered.startsWith(String(year)) ? addDays(registered, 60) : `${year}-01-31`;
    return { kind: 'vignette', state: 'none', record: null, days: daysUntil(deadline, now), due: deadline, isDeadline: true };
  }
  const coveredYear = Number(record.validUntil.slice(0, 4));
  const deadline = coveredYear >= year ? `${coveredYear + 1}-01-31` : `${year}-01-31`;
  const days = daysUntil(deadline, now);
  return { kind: 'vignette', state: stateOf(days), record, days, due: deadline, isDeadline: true };
}

export function complianceStatus(kind: ComplianceKind, records: ComplianceRecord[], vehicle: { dateMiseEnCirculation?: string | null }, now: Date): ComplianceStatus {
  if (kind === 'vignette') return vignetteStatus(records, vehicle, now);
  if (!records.some((record) => record.kind === kind)) return { kind, state: 'none', record: null, days: null, due: null, isDeadline: false };
  const today = dayKey(now);
  const { covering, chainEnd, past, upcoming } = coverageAt(records, kind, today);
  if (covering && chainEnd) {
    const days = daysUntil(chainEnd, now);
    return { kind, state: stateOf(days), record: covering, days, due: chainEnd, isDeadline: false, renewedUntil: chainEnd !== covering.validUntil ? chainEnd : null };
  }
  // Rien ne couvre aujourd'hui : expirée (dernière période terminée), ou « pas encore couverte » (seules des périodes à venir existent).
  if (past) return { kind, state: 'expired', record: past, days: daysUntil(past.validUntil, now), due: past.validUntil, isDeadline: false, upcomingFrom: upcoming?.validFrom ?? null, uncovered: true };
  return { kind, state: 'expired', record: null, days: 0, due: today, isDeadline: false, upcomingFrom: upcoming?.validFrom ?? null, uncovered: true };
}

export const allStatuses = (records: ComplianceRecord[], vehicle: { dateMiseEnCirculation?: string | null }, now: Date) => COMPLIANCE_KINDS.map((kind) => complianceStatus(kind, records, vehicle, now));

// ------------------------------------------------------------------ renouvellement

export type RenewalSuggestion = { validFrom: string; validUntil: string };

/**
 * Période proposée pour un renouvellement (toujours modifiable) :
 *  - assurance : 12 mois, qui commencent le lendemain de la fin en cours (aujourd'hui si elle est expirée ou absente) ;
 *  - visite technique : à partir d'aujourd'hui (date de la visite), pour la périodicité réglée par l'agence (6 mois par défaut) ;
 *  - vignette : l'année civile (la suivante si l'année en cours est déjà couverte).
 */
export function suggestRenewal(kind: ComplianceKind, current: ComplianceRecord | null, settings: ComplianceSettings, now: Date, months?: number): RenewalSuggestion {
  const today = dayKey(now);
  if (kind === 'vignette') {
    const year = current && current.validUntil >= `${now.getFullYear()}-12-31` ? now.getFullYear() + 1 : now.getFullYear();
    return { validFrom: `${year}-01-01`, validUntil: `${year}-12-31` };
  }
  // Aucune durée prédéfinie : sans durée réglée, la fin reste à indiquer (chaîne vide).
  const length = months ?? periodOf(kind, current, settings);
  if (kind === 'visite_technique') return { validFrom: today, validUntil: length === null ? '' : addMonths(today, length) };
  const start = current && current.validUntil >= today ? addDays(current.validUntil, 1) : today;
  return { validFrom: start, validUntil: length === null ? '' : addDays(addMonths(start, length), -1) };
}

/**
 * Durée de la période en mois, réglée une fois puis reprise à chaque renouvellement : celle de la période en cours si elle a été réglée,
 * sinon `null` (aucune valeur prédéfinie). Toujours `null` pour la vignette (année civile).
 */
export function periodOf(kind: ComplianceKind, current: ComplianceRecord | null, settings: ComplianceSettings): number | null {
  if (kind === 'vignette') return null;
  void settings; // la périodicité de l'agence n'est plus une valeur prédéfinie : seule la durée réglée sur la période compte
  return current?.periodMonths ?? null;
}

/** Fin de période quand on change la durée : assurance = veille de l'anniversaire, visite = date + durée. `from` : AAAA-MM-JJ. */
export function renewalEnd(kind: ComplianceKind, from: string, months: number): string {
  return kind === 'visite_technique' ? addMonths(from, months) : addDays(addMonths(from, months), -1);
}

export type RenewalDraft = { validFrom: string; validUntil: string; reference: string; provider: string; amount: string; notes: string };
export type RenewalErrors = Partial<Record<'validFrom' | 'validUntil' | 'amount' | 'reference' | 'provider', 'required' | 'invalid_date' | 'ends_before_start' | 'ends_before_current' | 'invalid_amount' | 'too_long'>>;

const isoOf = (text: string): string | null => {
  const date = parseFrDate(text);
  return date ? dayKey(date) : null;
};

/** JJ/MM/AAAA ↔ AAAA-MM-JJ pour l'affichage et la saisie. */
export const toDisplayDate = (iso: string | null | undefined) => {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
};

/**
 * Contrôles d'un renouvellement : fin obligatoire et réelle ; début (facultatif) réel et pas après la fin ; la nouvelle période doit finir
 * APRÈS celle en cours (sinon ce n'est pas un renouvellement : une correction se fait sur la ligne de l'historique) ; montant ≥ 0.
 */
export function validateRenewal(draft: RenewalDraft, current: ComplianceRecord | null): RenewalErrors {
  const errors: RenewalErrors = {};
  const until = draft.validUntil.trim() ? isoOf(draft.validUntil) : null;
  const from = draft.validFrom.trim() ? isoOf(draft.validFrom) : null;
  if (!draft.validUntil.trim()) errors.validUntil = 'required';
  else if (!until) errors.validUntil = 'invalid_date';
  if (draft.validFrom.trim() && !from) errors.validFrom = 'invalid_date';
  if (until && from && from > until) errors.validUntil = 'ends_before_start';
  if (until && current && until <= current.validUntil && !errors.validUntil) errors.validUntil = 'ends_before_current';
  if (draft.amount.trim()) {
    const amount = Number(draft.amount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount < 0) errors.amount = 'invalid_amount';
  }
  if (draft.reference.trim().length > 80) errors.reference = 'too_long';
  if (draft.provider.trim().length > 120) errors.provider = 'too_long';
  return errors;
}

export function renewalInput(vehicleId: string, kind: ComplianceKind, draft: RenewalDraft, documentPath: string | null, periodMonths: number | null = null): ComplianceInput {
  return {
    vehicleId,
    kind,
    validFrom: draft.validFrom.trim() ? isoOf(draft.validFrom) : null,
    validUntil: isoOf(draft.validUntil) as string,
    reference: draft.reference.trim() || null,
    provider: draft.provider.trim() || null,
    amount: draft.amount.trim() ? Number(draft.amount.replace(',', '.')) : null,
    documentPath,
    notes: draft.notes.trim() || null,
    periodMonths,
  };
}

export function renewalDraft(suggestion: RenewalSuggestion): RenewalDraft {
  return { validFrom: toDisplayDate(suggestion.validFrom), validUntil: toDisplayDate(suggestion.validUntil), reference: '', provider: '', amount: '', notes: '' };
}

// ------------------------------------------------------------------ avant une location

export type ComplianceWarning = { kind: ComplianceKind; code: 'missing' | 'expired' | 'expires_before_end'; due: string | null };

/**
 * Avertissements (jamais bloquants) pour louer un véhicule du jour `start` au jour `end` :
 *  - rien d'enregistré pour l'assurance ou la visite technique (« à vérifier ») ;
 *  - obligation déjà expirée au départ ;
 *  - obligation qui expire pendant la location.
 * La vignette n'avertit que si elle est EXPIRÉE (date limite dépassée) : elle ne « finit » pas en cours de route.
 */
export function rentalWarnings(records: ComplianceRecord[], vehicle: { dateMiseEnCirculation?: string | null }, start: Date, end: Date, now: Date): ComplianceWarning[] {
  const startKey = dayKey(start.getTime() < now.getTime() ? now : start);
  const endKey = dayKey(end);
  const warnings: ComplianceWarning[] = [];
  for (const kind of ['assurance', 'visite_technique'] as const) {
    if (!records.some((record) => record.kind === kind)) {
      warnings.push({ kind, code: 'missing', due: null });
      continue;
    }
    // Ce qui couvre le JOUR DU DÉPART (pas la période qui finit le plus tard : elle peut ne pas avoir commencé).
    const { covering, chainEnd, past } = coverageAt(records, kind, startKey);
    if (!covering || !chainEnd) warnings.push({ kind, code: 'expired', due: past?.validUntil ?? startKey });
    else if (chainEnd < endKey) warnings.push({ kind, code: 'expires_before_end', due: chainEnd });
  }
  const vignette = complianceStatus('vignette', records, vehicle, now);
  if (vignette.state === 'expired') warnings.push({ kind: 'vignette', code: 'expired', due: vignette.due });
  return warnings;
}

// ------------------------------------------------------------------ « À régulariser »

export type RegularizationIssue = { kind: 'assurance' | 'visite_technique'; due: string; daysOver: number };

/**
 * Obligations CRITIQUES : assurance ou visite technique dont la période ENREGISTRÉE est expirée (la fin est dépassée). Le véhicule porte alors
 * l'indicateur « À régulariser » jusqu'à la régularisation effective (un renouvellement enregistré). Une obligation « À compléter » (aucune
 * période enregistrée) n'est pas une preuve d'expiration : avertissement seulement. La vignette n'est pas critique.
 * BIBIP informe, il ne bloque rien ; l'absence de blocage n'est pas une autorisation légale de remettre un véhicule non conforme.
 */
export function regularizationIssues(records: ComplianceRecord[], vehicle: { dateMiseEnCirculation?: string | null }, now: Date): RegularizationIssue[] {
  const issues: RegularizationIssue[] = [];
  for (const kind of ['assurance', 'visite_technique'] as const) {
    const status = complianceStatus(kind, records, vehicle, now);
    if (status.state === 'expired' && status.due && status.days !== null) issues.push({ kind, due: status.due, daysOver: -status.days });
  }
  return issues;
}

/**
 * Véhicules « À régulariser » d'une liste : pour chacun, ses obligations critiques expirées. Les véhicules archivés sont ignorés.
 * Même règle partout (fiche, accueil, Ma Flotte) ; ne change JAMAIS le statut opérationnel du véhicule.
 */
export function regularizationByVehicle(records: ComplianceRecord[], vehicles: { id: string; archivedAt?: string | null; dateMiseEnCirculation?: string | null }[], now: Date): Map<string, RegularizationIssue[]> {
  const byVehicle = new Map<string, ComplianceRecord[]>();
  for (const record of records) byVehicle.set(record.vehicleId, [...(byVehicle.get(record.vehicleId) ?? []), record]);
  const result = new Map<string, RegularizationIssue[]>();
  for (const vehicle of vehicles) {
    if (vehicle.archivedAt) continue;
    const issues = regularizationIssues(byVehicle.get(vehicle.id) ?? [], vehicle, now);
    if (issues.length > 0) result.set(vehicle.id, issues);
  }
  return result;
}
