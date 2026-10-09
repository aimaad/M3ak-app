import { canTransitionContractStatus, isTerminalContractStatus } from '../status-transitions';

describe('canTransitionContractStatus', () => {
  it('suit le cycle de vie normal', () => {
    expect(canTransitionContractStatus('preparation', 'pret_a_signer')).toBe(true);
    expect(canTransitionContractStatus('pret_a_signer', 'signe')).toBe(true);
    expect(canTransitionContractStatus('signe', 'en_cours')).toBe(true);
    expect(canTransitionContractStatus('en_cours', 'cloture')).toBe(true);
  });

  it('autorise l’annulation avant le départ, jamais après', () => {
    expect(canTransitionContractStatus('preparation', 'annule')).toBe(true);
    expect(canTransitionContractStatus('pret_a_signer', 'annule')).toBe(true);
    expect(canTransitionContractStatus('signe', 'annule')).toBe(true);
    expect(canTransitionContractStatus('en_cours', 'annule')).toBe(false);
  });

  it('interdit de sauter une étape', () => {
    expect(canTransitionContractStatus('preparation', 'signe')).toBe(false);
    expect(canTransitionContractStatus('preparation', 'en_cours')).toBe(false);
    expect(canTransitionContractStatus('pret_a_signer', 'en_cours')).toBe(false);
  });

  it('interdit toute transition depuis un statut terminal', () => {
    expect(canTransitionContractStatus('cloture', 'en_cours')).toBe(false);
    expect(canTransitionContractStatus('annule', 'preparation')).toBe(false);
  });
});

describe('isTerminalContractStatus', () => {
  it('cloture et annule sont terminaux', () => {
    expect(isTerminalContractStatus('cloture')).toBe(true);
    expect(isTerminalContractStatus('annule')).toBe(true);
  });

  it('les autres statuts ne le sont pas', () => {
    expect(isTerminalContractStatus('preparation')).toBe(false);
    expect(isTerminalContractStatus('signe')).toBe(false);
  });
});
