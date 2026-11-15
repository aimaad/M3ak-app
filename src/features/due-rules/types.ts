/** Règles d'échéances de l'agence (migration 0076) : quoi surveiller et à quel rythme. Valeurs proposées INDICATIVES, toujours modifiables. */
export type DueRuleKind = 'vidange' | 'freins' | 'pneus' | 'assurance' | 'visite_technique' | 'vignette';
export const MAINTENANCE_RULE_KINDS: DueRuleKind[] = ['vidange', 'freins', 'pneus'];
export const LEGAL_RULE_KINDS: DueRuleKind[] = ['assurance', 'visite_technique', 'vignette'];
export const DUE_RULE_KINDS: DueRuleKind[] = [...MAINTENANCE_RULE_KINDS, ...LEGAL_RULE_KINDS];

export type DueRule = { kind: DueRuleKind; enabled: boolean; repeatKm: number | null; repeatMonths: number | null };

/** Valeurs proposées : vidange 10 000 km, freins 30 000 km, pneus 40 000 km. Les préconisations du constructeur et l'état réel du véhicule priment. */
export const PROPOSED_RULES: DueRule[] = [
  { kind: 'vidange', enabled: true, repeatKm: 10_000, repeatMonths: null },
  { kind: 'freins', enabled: true, repeatKm: 30_000, repeatMonths: null },
  { kind: 'pneus', enabled: true, repeatKm: 40_000, repeatMonths: null },
  { kind: 'assurance', enabled: true, repeatKm: null, repeatMonths: null },
  { kind: 'visite_technique', enabled: true, repeatKm: null, repeatMonths: null },
  { kind: 'vignette', enabled: true, repeatKm: null, repeatMonths: null },
];
