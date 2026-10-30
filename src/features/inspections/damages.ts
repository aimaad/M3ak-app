import type { PhotoAngle } from './types';

export type DamageSeverity = 'leger' | 'modere' | 'grave';
export type DamageStatus = 'propose' | 'confirme' | 'rejete';
export type DamageComparison = 'comparee' | 'retour_seul' | 'depart';

export const DAMAGE_SEVERITIES: DamageSeverity[] = ['leger', 'modere', 'grave'];

export const DAMAGE_TYPES = ['rayure', 'choc', 'bosse', 'fissure', 'eclat', 'piece_manquante', 'salissure', 'tache', 'dechirure', 'brulure', 'casse', 'usure', 'autre'] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const DAMAGE_ZONES = [
  'pare_choc_avant', 'pare_choc_arriere', 'capot', 'toit', 'coffre',
  'aile_avant_gauche', 'aile_avant_droit', 'aile_arriere_gauche', 'aile_arriere_droit',
  'portiere_avant_gauche', 'portiere_avant_droit', 'portiere_arriere_gauche', 'portiere_arriere_droit',
  'pare_brise', 'lunette_arriere', 'vitre', 'retroviseur_gauche', 'retroviseur_droit',
  'calandre', 'phare_avant', 'feu_arriere', 'bas_de_caisse',
  'jante_avant_gauche', 'jante_avant_droit', 'jante_arriere_gauche', 'jante_arriere_droit',
  'pneu_avant_gauche', 'pneu_avant_droit', 'pneu_arriere_gauche', 'pneu_arriere_droit',
  'tableau_de_bord', 'volant', 'frein_a_main', 'siege_avant_gauche', 'siege_avant_droit', 'banquette_arriere',
  'plafond', 'tapis', 'coffre_interieur', 'interieur', 'autre',
] as const;
export type DamageZone = (typeof DAMAGE_ZONES)[number];

/** Cadre du dommage sur la photo, coordonnées relatives (0 à 1). */
export type DamageBox = { x: number; y: number; w: number; h: number };

export type Damage = {
  id: string;
  inspectionId: string;
  photoId: string | null;
  angle: PhotoAngle | null;
  zone: DamageZone;
  type: DamageType;
  gravite: DamageSeverity;
  /** 0 à 1, null pour un dommage saisi à la main. */
  confiance: number | null;
  nouveau: boolean;
  description: string | null;
  coutEstime: number | null;
  coutValide: number | null;
  bbox: DamageBox | null;
  comparaison: DamageComparison;
  statut: DamageStatus;
  source: 'ia' | 'manuel';
  /** À l'inspection de départ : le dommage est-il inscrit au contrat ? (choix de l'employé, oui par défaut) */
  dansContrat: boolean;
};

/** Seuil en dessous duquel la proposition de l'IA doit être vérifiée de près. */
export const LOW_CONFIDENCE = 0.6;

/** Coût retenu : celui validé par l'employé, sinon l'estimation de l'IA. */
export function effectiveCost(damage: Pick<Damage, 'coutValide' | 'coutEstime'>): number {
  return damage.coutValide ?? damage.coutEstime ?? 0;
}

/** Dommages imputables au client : nouveaux (apparus pendant la location) ET confirmés par l'employé. */
export function chargeableDamages(damages: Damage[]): Damage[] {
  return damages.filter((damage) => damage.statut === 'confirme' && damage.nouveau);
}

export function totalCharge(damages: Damage[]): number {
  return chargeableDamages(damages).reduce((sum, damage) => sum + effectiveCost(damage), 0);
}

export function confidencePercent(damage: Pick<Damage, 'confiance'>): number | null {
  return damage.confiance === null ? null : Math.round(damage.confiance * 100);
}

/** À vérifier en priorité : lecture peu sûre, ou aucune photo de départ pour comparer. */
export function needsCheck(damage: Damage): boolean {
  if (damage.source === 'manuel' || damage.statut !== 'propose') return false;
  return (damage.confiance ?? 1) < LOW_CONFIDENCE || damage.comparaison === 'retour_seul';
}

export type DamageCounts = { total: number; nouveaux: number; existants: number; aVerifier: number; confirmes: number; rejetes: number };

export function countDamages(damages: Damage[]): DamageCounts {
  const active = damages.filter((damage) => damage.statut !== 'rejete');
  return {
    total: active.length,
    nouveaux: active.filter((damage) => damage.nouveau).length,
    existants: active.filter((damage) => !damage.nouveau).length,
    aVerifier: damages.filter(needsCheck).length,
    confirmes: damages.filter((damage) => damage.statut === 'confirme').length,
    rejetes: damages.filter((damage) => damage.statut === 'rejete').length,
  };
}

/** Tri d'affichage : nouveaux d'abord, puis plus graves, puis plus sûrs. */
export function sortDamages(damages: Damage[]): Damage[] {
  const rank: Record<DamageSeverity, number> = { grave: 0, modere: 1, leger: 2 };
  return [...damages].sort(
    (a, b) => Number(b.nouveau) - Number(a.nouveau) || rank[a.gravite] - rank[b.gravite] || (b.confiance ?? 1) - (a.confiance ?? 1)
  );
}

/** Peut-on valider la retenue ? Il faut que plus aucun dommage nouveau ne soit en attente de décision. */
export function pendingNewDamages(damages: Damage[]): Damage[] {
  return damages.filter((damage) => damage.nouveau && damage.statut === 'propose');
}
