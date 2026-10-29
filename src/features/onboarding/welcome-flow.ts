import type { StartStep, StartStepKey } from './getting-started';

/** Étapes proposées dans le parcours plein écran : celles qui restent à faire (« joined » est déjà fait par définition). */
export function welcomeSteps(steps: StartStep[] | null): StartStep[] {
  return (steps ?? []).filter((step) => step.key !== 'joined');
}

export type WelcomeScreen =
  | { kind: 'intro'; total: number }
  | { kind: 'step'; step: StartStep; position: number; total: number }
  | { kind: 'done'; skipped: number };

/**
 * Écran à afficher maintenant. `skipped` = étapes passées volontairement. Une étape faite (donnée présente) est cochée
 * toute seule : on passe à la suivante sans qu'il y ait rien à faire. Le total compte toutes les étapes du parcours.
 */
export function currentWelcomeScreen(steps: StartStep[] | null, started: boolean, skipped: StartStepKey[]): WelcomeScreen {
  const all = welcomeSteps(steps);
  const total = all.length;
  if (!started) return { kind: 'intro', total: all.filter((step) => !step.done).length };
  const next = all.find((step) => !step.done && !skipped.includes(step.key));
  if (!next) return { kind: 'done', skipped: all.filter((step) => !step.done).length };
  return { kind: 'step', step: next, position: all.indexOf(next) + 1, total };
}

/**
 * Faut-il ouvrir le parcours tout seul à l'arrivée sur l'accueil ? Une seule fois, pour un propriétaire ou un
 * responsable dont l'agence est encore totalement vide (aucune voiture, aucun client, aucune location).
 */
export function shouldAutoOpenWelcome(input: { steps: StartStep[] | null; seen: boolean | null; vehicleCount: number; customerCount: number; rentalCount: number }): boolean {
  if (input.seen !== false || !input.steps) return false;
  return input.vehicleCount === 0 && input.customerCount === 0 && input.rentalCount === 0 && welcomeSteps(input.steps).some((step) => !step.done);
}

export function welcomeSeenKey(userId: string | undefined, agencyId: string | undefined): string | null {
  return userId && agencyId ? `m3ak.welcome.seen.${userId}.${agencyId}` : null;
}
