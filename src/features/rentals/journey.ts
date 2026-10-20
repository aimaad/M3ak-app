import type { ContractStatus } from '@/features/contracts/types';

import type { RentalStatus } from './types';

/**
 * Parcours d'une location, étape par étape : ce qu'il reste à faire AVANT le départ (confirmation, vérifications,
 * contrat, inspection, acompte, départ), puis AU RETOUR (inspection, dommages, retour, caution). Une seule étape est
 * « en cours » à la fois ; les suivantes restent verrouillées tant que la précédente n'est pas terminée.
 */
export type JourneyStepKey =
  | 'confirmation'
  | 'checks'
  | 'contract'
  | 'inspection'
  | 'payment'
  | 'start'
  | 'inspection_retour'
  | 'damages'
  | 'return'
  | 'deposit';

/** done = terminée ; current = à faire maintenant ; locked = pas encore possible ; attention = non bloquante mais à regarder. */
export type JourneyStepStatus = 'done' | 'current' | 'locked' | 'attention';

export type JourneyStep = { key: JourneyStepKey; status: JourneyStepStatus };

export type JourneyInput = {
  rentalStatus: RentalStatus;
  /** Vérification avant départ : true = tout est en règle, false = il manque quelque chose, null = pas encore chargée. */
  departureOk: boolean | null;
  /** La politique de l'agence bloque le départ tant que la vérification n'est pas en règle. */
  departureEnforced: boolean;
  contractStatus: ContractStatus | null;
  inspectionDepartDone: boolean;
  inspectionRetourDone: boolean;
  /** L'analyse des photos de retour a été faite (dommages à relire). */
  retourAnalyzed: boolean;
  acomptePrevu: number;
  acomptePaye: number;
  /** Une caution existe pour cette location, et elle n'est pas encore soldée (restituée ou retenue). */
  hasDeposit: boolean;
  depositOpen: boolean;
};

export type Journey = { phase: 'depart' | 'retour' | 'termine' | 'annule'; steps: JourneyStep[]; currentKey: JourneyStepKey | null };

type Draft = { key: JourneyStepKey; done: boolean; passable?: boolean };

/** Applique la règle commune : la première étape non terminée (et non « passable ») est en cours, les suivantes sont verrouillées. */
function resolve(drafts: Draft[]): { steps: JourneyStep[]; currentKey: JourneyStepKey | null } {
  let currentKey: JourneyStepKey | null = null;
  const steps = drafts.map((draft): JourneyStep => {
    if (draft.done) return { key: draft.key, status: 'done' };
    if (currentKey !== null) return { key: draft.key, status: 'locked' };
    if (draft.passable) return { key: draft.key, status: 'attention' };
    currentKey = draft.key;
    return { key: draft.key, status: 'current' };
  });
  return { steps, currentKey };
}

export function computeJourney(input: JourneyInput): Journey {
  if (input.rentalStatus === 'annulee') return { phase: 'annule', steps: [], currentKey: null };

  if (input.rentalStatus === 'en_cours' || input.rentalStatus === 'terminee') {
    const finished = input.rentalStatus === 'terminee';
    const drafts: Draft[] = [
      { key: 'inspection_retour', done: input.inspectionRetourDone || finished },
      { key: 'damages', done: input.retourAnalyzed || finished },
      { key: 'return', done: finished },
      ...(input.hasDeposit ? [{ key: 'deposit' as const, done: finished && !input.depositOpen }] : []),
    ];
    return { phase: finished ? 'termine' : 'retour', ...resolve(drafts) };
  }

  const confirmed = input.rentalStatus !== 'en_attente_confirmation';
  const contractSigned = input.contractStatus === 'signe' || input.contractStatus === 'en_cours' || input.contractStatus === 'cloture';
  const checksOk = confirmed && input.departureOk === true;
  const drafts: Draft[] = [
    { key: 'confirmation', done: confirmed },
    // Vérification non en règle mais non bloquante pour cette agence : on le signale sans bloquer la suite.
    { key: 'checks', done: checksOk, passable: confirmed && input.departureOk === false && !input.departureEnforced },
    { key: 'contract', done: contractSigned },
    { key: 'inspection', done: input.inspectionDepartDone },
    // L'acompte n'empêche pas le départ (le serveur ne l'exige pas) : il reste affiché tant qu'il n'est pas encaissé.
    { key: 'payment', done: input.acomptePrevu <= 0 || input.acomptePaye >= input.acomptePrevu, passable: true },
    { key: 'start', done: false },
  ];
  return { phase: 'depart', ...resolve(drafts) };
}

export function stepNumber(journey: Journey, key: JourneyStepKey): number {
  return journey.steps.findIndex((step) => step.key === key) + 1;
}
