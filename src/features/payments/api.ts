import { getSupabase } from '@/lib/supabase';

import type { Payment, PaymentInput } from './types';

type PaymentRow = {
  id: string;
  agency_id: string;
  rental_id: string;
  montant: number;
  methode: Payment['methode'];
  statut: Payment['statut'];
  date_paiement: string;
};

function fromRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    agencyId: row.agency_id,
    rentalId: row.rental_id,
    montant: Number(row.montant),
    methode: row.methode,
    statut: row.statut,
    datePaiement: row.date_paiement,
  };
}

export async function listPaymentsForRental(rentalId: string): Promise<Payment[]> {
  const { data, error } = await getSupabase()
    .from('payments')
    .select('*')
    .eq('rental_id', rentalId)
    .order('date_paiement', { ascending: false });

  if (error) throw error;
  return (data as PaymentRow[]).map(fromRow);
}

export async function createPayment(
  agencyId: string,
  rentalId: string,
  input: PaymentInput
): Promise<Payment> {
  const { data, error } = await getSupabase()
    .from('payments')
    .insert({
      agency_id: agencyId,
      rental_id: rentalId,
      montant: input.montant,
      methode: input.methode,
      statut: 'paye',
    })
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as PaymentRow);
}
