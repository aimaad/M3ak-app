import type { AuditEntry } from './types';

type T = (key: string, params?: Record<string, unknown>) => string;

/** Actions qui ont un texte dédié ; toute autre action affiche un texte générique, jamais un code technique. */
const KNOWN_ACTIONS = new Set([
  'rental_created', 'rental_confirmed', 'rental_started', 'rental_completed', 'rental_cancelled', 'rental_status_changed', 'rental_dates_changed',
  'payment_recorded', 'payment_status_changed',
  'customer_created', 'customer_updated', 'customer_archived', 'customer_reactivated',
  'customer_document_added', 'customer_document_deleted', 'customer_note_added', 'customer_note_edited', 'customer_note_deleted',
  'vehicle_created', 'vehicle_archived', 'vehicle_reactivated', 'vehicle_price_changed',
  'contract_created', 'contract_signed', 'contract_closed', 'contract_cancelled', 'contract_status_changed',
  'deposit_blocked', 'deposit_resolved',
  'maintenance_created', 'maintenance_started', 'maintenance_completed',
  'inspection_created', 'inspection_completed', 'departure_check_confirmed',
  'branch_created', 'branch_updated', 'branch_deleted', 'invite_created', 'invite_resent', 'invite_revoked',
  'member_joined', 'member_role_changed', 'member_removed',
  'ocr_key_set', 'ocr_key_cleared', 'ocr_cloud_toggled', 'ai_insights_toggled',
]);

/** Champs de fiche client dont on peut citer le NOM (jamais la valeur) ; les autres colonnes sont ignorées. */
const CUSTOMER_FIELDS = new Set([
  'nom_complet', 'prenom', 'nom', 'telephone', 'telephone_secondaire', 'email', 'adresse', 'ville', 'pays', 'date_naissance',
  'cin_ou_passeport', 'numero_permis', 'langue_preferee', 'type_client', 'raison_sociale', 'ice', 'consentement_donnees',
]);

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const money = (value: unknown): string => {
  const n = num(value) ?? (typeof value === 'string' ? Number(value) : NaN);
  return Number.isFinite(n) ? `${Math.round(n).toLocaleString('fr-FR')} MAD` : '—';
};

export function actorLabel(entry: Pick<AuditEntry, 'actorName'>, t: T): string {
  return entry.actorName?.trim() || t('journal.unknownActor');
}

/** Phrase lisible d'une ligne du journal : « Sara a créé la location RES-2026-00003 (Dacia Logan pour Fouad B.) ». */
export function describeAuditEntry(entry: AuditEntry, t: T): string {
  const details = entry.details ?? {};
  const actor = actorLabel(entry, t);
  const action = KNOWN_ACTIONS.has(entry.action) ? entry.action : 'unknown';

  const method = str(details.method);
  const docType = str(details.type);
  const fields = Array.isArray(details.fields)
    ? details.fields.filter((f): f is string => typeof f === 'string' && CUSTOMER_FIELDS.has(f)).map((f) => t(`journal.fields.${f}`))
    : [];

  return t(`journal.actions.${action}`, {
    actor,
    target: entry.targetLabel ?? '—',
    vehicle: str(details.vehicle) ?? '—',
    customer: str(details.customer) ?? '—',
    amount: money(details.amount),
    total: money(details.total),
    cost: money(details.cost),
    method: method ? t(`locations.paymentMethods.${method}`) : '—',
    docType: docType ? t(`customer.documentTypes.${docType}`, { defaultValue: '—' }) : '—',
    maintenanceType: docType ? t(`maintenance.types.${docType}`, { defaultValue: '—' }) : '—',
    inspectionType: docType ? t(`inspection.title.${docType}`, { defaultValue: '—' }) : '—',
    fields: fields.length ? fields.join(', ') : '—',
    from: money(details.from),
    to: money(details.to),
    state: details.enabled === true ? t('journal.enabled') : t('journal.disabled'),
    role: str(details.role) ?? '—',
  });
}
