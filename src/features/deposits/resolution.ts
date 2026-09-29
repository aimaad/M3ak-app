import type { DepositStatus } from './types';

export type DepositResolution = {
  montantRetenu: number;
  montantRestitue: number;
  statut: DepositStatus;
};

/**
 * Calcule la retenue sur la caution : le montant demandé est plafonné entre 0 et le
 * montant bloqué, le reste est restitué au client.
 */
export function resolveDeposit(montantBloque: number, montantRetenuDemande: number): DepositResolution {
  const montantRetenu = Math.min(Math.max(montantRetenuDemande, 0), montantBloque);
  const montantRestitue = montantBloque - montantRetenu;

  let statut: DepositStatus;
  if (montantRetenu <= 0) {
    statut = 'restituee';
  } else if (montantRetenu >= montantBloque) {
    statut = 'retenue';
  } else {
    statut = 'partiellement_retenue';
  }

  return { montantRetenu, montantRestitue, statut };
}
