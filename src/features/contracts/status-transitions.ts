import type { ContractStatus } from './types';

const ALLOWED_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  preparation: ['pret_a_signer', 'annule'],
  pret_a_signer: ['signe', 'annule'],
  signe: ['en_cours', 'annule'],
  en_cours: ['cloture'],
  cloture: [],
  annule: [],
};

export function canTransitionContractStatus(current: ContractStatus, next: ContractStatus): boolean {
  if (current === next) return false;
  return ALLOWED_TRANSITIONS[current].includes(next);
}

export function isTerminalContractStatus(status: ContractStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}
