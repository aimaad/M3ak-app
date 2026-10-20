import { computeJourney, type JourneyInput } from '../journey';

const base: JourneyInput = {
  rentalStatus: 'en_attente_confirmation',
  departureOk: null,
  departureEnforced: false,
  contractStatus: null,
  inspectionDepartDone: false,
  inspectionRetourDone: false,
  retourAnalyzed: false,
  acomptePrevu: 0,
  acomptePaye: 0,
  hasDeposit: true,
  depositOpen: true,
};
const status = (input: Partial<JourneyInput>) => Object.fromEntries(computeJourney({ ...base, ...input }).steps.map((s) => [s.key, s.status]));

describe('parcours avant le départ', () => {
  it("commence par la confirmation et verrouille tout le reste", () => {
    expect(status({})).toEqual({ confirmation: 'current', checks: 'locked', contract: 'locked', inspection: 'locked', payment: 'done', start: 'locked' });
    expect(computeJourney(base).currentKey).toBe('confirmation');
  });

  it('une location confirmée passe aux vérifications avant départ', () => {
    expect(computeJourney({ ...base, rentalStatus: 'confirmee' }).currentKey).toBe('checks');
  });

  it('suit l\'ordre : vérifications, contrat, inspection, puis le départ', () => {
    const confirmed = { ...base, rentalStatus: 'confirmee' as const, departureOk: true };
    expect(computeJourney(confirmed).currentKey).toBe('contract');
    expect(computeJourney({ ...confirmed, contractStatus: 'pret_a_signer' }).currentKey).toBe('contract');
    expect(computeJourney({ ...confirmed, contractStatus: 'signe' }).currentKey).toBe('inspection');
    expect(computeJourney({ ...confirmed, contractStatus: 'signe', inspectionDepartDone: true }).currentKey).toBe('start');
  });

  it("une vérification non en règle bloque seulement si l'agence l'a décidé", () => {
    const confirmed = { ...base, rentalStatus: 'confirmee' as const, departureOk: false };
    expect(computeJourney({ ...confirmed, departureEnforced: true }).currentKey).toBe('checks');
    const soft = computeJourney({ ...confirmed, departureEnforced: false });
    expect(soft.steps.find((s) => s.key === 'checks')?.status).toBe('attention');
    expect(soft.currentKey).toBe('contract');
  });

  it("l'acompte non encaissé est signalé sans empêcher le départ", () => {
    const ready = { ...base, rentalStatus: 'confirmee' as const, departureOk: true, contractStatus: 'signe' as const, inspectionDepartDone: true, acomptePrevu: 500, acomptePaye: 0 };
    const journey = computeJourney(ready);
    expect(journey.steps.find((s) => s.key === 'payment')?.status).toBe('attention');
    expect(journey.currentKey).toBe('start');
    expect(computeJourney({ ...ready, acomptePaye: 500 }).steps.find((s) => s.key === 'payment')?.status).toBe('done');
    expect(computeJourney({ ...ready, acomptePrevu: 0 }).steps.find((s) => s.key === 'payment')?.status).toBe('done');
  });

  it('une étape déjà faite reste « terminée » même si une précédente ne l\'est pas', () => {
    const journey = computeJourney({ ...base, rentalStatus: 'confirmee', departureOk: false, departureEnforced: true, inspectionDepartDone: true });
    expect(journey.steps.find((s) => s.key === 'inspection')?.status).toBe('done');
    expect(journey.steps.find((s) => s.key === 'start')?.status).toBe('locked');
  });
});

describe('parcours au retour', () => {
  it('inspection de retour, dommages, retour, puis caution', () => {
    const running = { ...base, rentalStatus: 'en_cours' as const };
    expect(computeJourney(running).phase).toBe('retour');
    expect(computeJourney(running).currentKey).toBe('inspection_retour');
    expect(computeJourney({ ...running, inspectionRetourDone: true }).currentKey).toBe('damages');
    expect(computeJourney({ ...running, inspectionRetourDone: true, retourAnalyzed: true }).currentKey).toBe('return');
  });

  it("après la clôture, il ne reste que la caution tant qu'elle n'est pas soldée", () => {
    const finished = computeJourney({ ...base, rentalStatus: 'terminee' });
    expect(finished.phase).toBe('termine');
    expect(finished.currentKey).toBe('deposit');
    expect(computeJourney({ ...base, rentalStatus: 'terminee', depositOpen: false }).currentKey).toBeNull();
    expect(computeJourney({ ...base, rentalStatus: 'terminee', hasDeposit: false }).steps.map((s) => s.key)).not.toContain('deposit');
  });

  it('une location annulée n\'a plus de parcours', () => {
    expect(computeJourney({ ...base, rentalStatus: 'annulee' })).toEqual({ phase: 'annule', steps: [], currentKey: null });
  });
});
