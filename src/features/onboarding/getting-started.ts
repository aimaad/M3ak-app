import type { AgencyRole } from '@/features/agency/types';

export type StartStepKey = 'joined' | 'logo' | 'vehicle' | 'customer' | 'rental';

export type StartStep = {
  key: StartStepKey;
  done: boolean;
  /** Écran où l'étape se réalise (null pour « rejoindre », déjà fait). */
  href: '/entreprise' | '/flotte/nouveau' | '/clients/nouveau' | '/locations/nouveau' | null;
};

export type StartInputs = {
  role: AgencyRole | null | undefined;
  hasLogo: boolean;
  vehicleCount: number;
  customerCount: number;
  rentalCount: number;
};

/**
 * Liste « Premiers pas » : 5 étapes au plus, la première déjà cochée (progression offerte). Le logo n'est proposé qu'au
 * propriétaire (lui seul peut le modifier). Null si le rôle n'est pas concerné (employé).
 */
export function buildGettingStarted(input: StartInputs): StartStep[] | null {
  if (input.role !== 'owner' && input.role !== 'manager') return null;
  const steps: StartStep[] = [{ key: 'joined', done: true, href: null }];
  if (input.role === 'owner') steps.push({ key: 'logo', done: input.hasLogo, href: '/entreprise' });
  steps.push(
    { key: 'vehicle', done: input.vehicleCount > 0, href: '/flotte/nouveau' },
    { key: 'customer', done: input.customerCount > 0, href: '/clients/nouveau' },
    { key: 'rental', done: input.rentalCount > 0, href: '/locations/nouveau' }
  );
  return steps;
}

export function progressOf(steps: StartStep[]): { done: number; total: number } {
  return { done: steps.filter((step) => step.done).length, total: steps.length };
}

/** Affichée tant que tout n'est pas fait et que l'utilisateur ne l'a pas masquée. */
export function shouldShowGettingStarted(steps: StartStep[] | null, dismissed: boolean): boolean {
  if (!steps || dismissed) return false;
  const { done, total } = progressOf(steps);
  return done < total;
}

/** Clé de mémorisation du masquage : une par personne et par agence. */
export function dismissKey(userId: string | undefined, agencyId: string | undefined): string | null {
  return userId && agencyId ? `m3ak.gettingStarted.dismissed.${userId}.${agencyId}` : null;
}
