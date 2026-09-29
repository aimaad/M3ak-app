import { getSupabase } from '@/lib/supabase';

import type { Deposit } from './types';

type DepositRow = {
  id: string;
  rental_id: string;
  agency_id: string;
  montant_bloque: number;
  montant_retenu: number;
  montant_restitue: number;
  statut: Deposit['statut'];
};

function fromRow(row: DepositRow): Deposit {
  return {
    id: row.id,
    rentalId: row.rental_id,
    agencyId: row.agency_id,
    montantBloque: Number(row.montant_bloque),
    montantRetenu: Number(row.montant_retenu),
    montantRestitue: Number(row.montant_restitue),
    statut: row.statut,
  };
}

export async function getDepositForRental(rentalId: string): Promise<Deposit | null> {
  const { data, error } = await getSupabase()
    .from('deposits')
    .select('*')
    .eq('rental_id', rentalId)
    .maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as DepositRow) : null;
}

export async function resolveDepositRecord(
  id: string,
  values: { montantRetenu: number; montantRestitue: number; statut: Deposit['statut'] }
): Promise<Deposit> {
  const { data, error } = await getSupabase()
    .from('deposits')
    .update({
      montant_retenu: values.montantRetenu,
      montant_restitue: values.montantRestitue,
      statut: values.statut,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as DepositRow);
}
