import type { Damage } from './damages';

/** Une ligne lisible pour le contrat : « Portière arrière droite — Rayure (Moyen) : rayure profonde de 12 cm ». */
export function damageLine(damage: Pick<Damage, 'zone' | 'type' | 'gravite' | 'description'>, t: (key: string) => string): string {
  const head = `${t(`inspection.analysis.zonesLabel.${damage.zone}`)} — ${t(`inspection.analysis.types.${damage.type}`)} (${t(`inspection.analysis.damages.severity.${damage.gravite}`)})`;
  return damage.description?.trim() ? `${head} : ${damage.description.trim()}` : head;
}

/** Dommages proposables pour le contrat : ceux que l'employé a confirmés à l'inspection de départ. */
export function contractDamageCandidates<T extends Pick<Damage, 'statut'>>(damages: T[]): T[] {
  return damages.filter((damage) => damage.statut === 'confirme');
}
