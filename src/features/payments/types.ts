export type PaymentMethod = 'especes' | 'carte' | 'virement' | 'cheque';
export type PaymentStatus = 'en_attente' | 'paye' | 'echoue' | 'rembourse';

export const PAYMENT_METHODS: PaymentMethod[] = ['especes', 'carte', 'virement', 'cheque'];

export type Payment = {
  id: string;
  agencyId: string;
  rentalId: string;
  montant: number;
  methode: PaymentMethod;
  statut: PaymentStatus;
  datePaiement: string;
};

export type PaymentInput = {
  montant: number;
  methode: PaymentMethod;
};
