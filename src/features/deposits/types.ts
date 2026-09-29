export type DepositStatus = 'bloquee' | 'partiellement_retenue' | 'retenue' | 'restituee';

export type Deposit = {
  id: string;
  rentalId: string;
  agencyId: string;
  montantBloque: number;
  montantRetenu: number;
  montantRestitue: number;
  statut: DepositStatus;
};
