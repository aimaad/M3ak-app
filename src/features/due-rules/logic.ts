import { DUE_RULE_KINDS, MAINTENANCE_RULE_KINDS, PROPOSED_RULES, type DueRule, type DueRuleKind } from './types';

/** Une ligne enregistrée remplace la valeur proposée (y compris « pas de périodicité ») ; sans ligne, la valeur proposée s'applique. */
export function mergeRules(rows: DueRule[]): DueRule[] {
  return PROPOSED_RULES.map((proposed) => rows.find((row) => row.kind === proposed.kind) ?? proposed);
}

export type RuleDraft = Record<DueRuleKind, { enabled: boolean; km: string; months: string }>;

export function draftFromRules(rules: DueRule[]): RuleDraft {
  const draft = {} as RuleDraft;
  for (const rule of mergeRules(rules)) draft[rule.kind] = { enabled: rule.enabled, km: rule.repeatKm !== null ? String(rule.repeatKm) : '', months: rule.repeatMonths !== null ? String(rule.repeatMonths) : '' };
  return draft;
}

export type RuleErrors = Partial<Record<DueRuleKind, 'invalid_km' | 'invalid_months'>>;

export function validateRuleDraft(draft: RuleDraft): RuleErrors {
  const errors: RuleErrors = {};
  for (const kind of MAINTENANCE_RULE_KINDS) {
    const { km, months } = draft[kind];
    if (km.trim() !== '' && (!Number.isInteger(Number(km)) || Number(km) < 1 || Number(km) > 1_000_000)) errors[kind] = 'invalid_km';
    else if (months.trim() !== '' && (!Number.isInteger(Number(months)) || Number(months) < 1 || Number(months) > 120)) errors[kind] = 'invalid_months';
  }
  return errors;
}

/** Règles modifiées par rapport à l'état initial (pour l'enregistrement et le résumé de la barre). */
export function changedKinds(initial: RuleDraft, draft: RuleDraft): DueRuleKind[] {
  return DUE_RULE_KINDS.filter((kind) => initial[kind].enabled !== draft[kind].enabled || initial[kind].km !== draft[kind].km || initial[kind].months !== draft[kind].months);
}

export function toRule(kind: DueRuleKind, draft: RuleDraft): DueRule {
  const isMaintenance = MAINTENANCE_RULE_KINDS.includes(kind);
  const { enabled, km, months } = draft[kind];
  return { kind, enabled, repeatKm: isMaintenance && km.trim() ? Number(km) : null, repeatMonths: isMaintenance && months.trim() ? Number(months) : null };
}

/** Une obligation désactivée par l'agence n'est plus proposée (la fiche ne la montre plus). */
export function enabledKinds(rules: DueRule[]): Set<DueRuleKind> {
  return new Set(mergeRules(rules).filter((rule) => rule.enabled).map((rule) => rule.kind));
}
