import { getCurrentUserId, getSupabase } from '@/lib/supabase';

import type { DepartInput, Rental, RentalInput, RetourInput } from './types';

type RentalRow = {
  id: string;
  agency_id: string;
  vehicle_id: string;
  customer_id: string;
  statut: Rental['statut'];
  date_debut_prevue: string;
  date_fin_prevue: string;
  date_depart_reel: string | null;
  date_retour_reel: string | null;
  km_depart: number | null;
  km_retour: number | null;
  carburant_depart: number | null;
  carburant_retour: number | null;
  prix_total: number | null;
  caution_montant: number;
  created_at: string;
};

function fromRow(row: RentalRow): Rental {
  return {
    id: row.id,
    agencyId: row.agency_id,
    vehicleId: row.vehicle_id,
    customerId: row.customer_id,
    statut: row.statut,
    dateDebutPrevue: row.date_debut_prevue,
    dateFinPrevue: row.date_fin_prevue,
    dateDepartReel: row.date_depart_reel,
    dateRetourReel: row.date_retour_reel,
    kmDepart: row.km_depart,
    kmRetour: row.km_retour,
    carburantDepart: row.carburant_depart,
    carburantRetour: row.carburant_retour,
    prixTotal: row.prix_total != null ? Number(row.prix_total) : null,
    cautionMontant: Number(row.caution_montant),
    createdAt: row.created_at,
  };
}

export async function listRentals(): Promise<Rental[]> {
  const { data, error } = await getSupabase()
    .from('rentals')
    .select('*')
    .order('date_debut_prevue', { ascending: false });

  if (error) throw error;
  return (data as RentalRow[]).map(fromRow);
}

export async function listRentalsForVehicle(vehicleId: string): Promise<Rental[]> {
  const { data, error } = await getSupabase().from('rentals').select('*').eq('vehicle_id', vehicleId);

  if (error) throw error;
  return (data as RentalRow[]).map(fromRow);
}

export async function getRental(id: string): Promise<Rental | null> {
  const { data, error } = await getSupabase().from('rentals').select('*').eq('id', id).maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as RentalRow) : null;
}

export async function createRental(agencyId: string, input: RentalInput): Promise<Rental> {
  const supabase = getSupabase();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('rentals')
    .insert({
      agency_id: agencyId,
      vehicle_id: input.vehicleId,
      customer_id: input.customerId,
      date_debut_prevue: input.dateDebutPrevue,
      date_fin_prevue: input.dateFinPrevue,
      prix_total: input.prixTotal,
      caution_montant: input.cautionMontant,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  const rental = fromRow(data as RentalRow);

  const { error: depositError } = await supabase.from('deposits').insert({
    agency_id: agencyId,
    rental_id: rental.id,
    montant_bloque: input.cautionMontant,
  });
  if (depositError) throw depositError;

  return rental;
}

export async function startRental(id: string, vehicleId: string, input: DepartInput): Promise<Rental> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('rentals')
    .update({
      statut: 'en_cours',
      date_depart_reel: new Date().toISOString(),
      km_depart: input.kmDepart,
      carburant_depart: input.carburantDepart,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  const { error: vehicleError } = await supabase
    .from('vehicles')
    .update({ statut: 'en_location', kilometrage: input.kmDepart })
    .eq('id', vehicleId);
  if (vehicleError) throw vehicleError;

  return fromRow(data as RentalRow);
}

export async function completeRental(id: string, vehicleId: string, input: RetourInput): Promise<Rental> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('rentals')
    .update({
      statut: 'terminee',
      date_retour_reel: new Date().toISOString(),
      km_retour: input.kmRetour,
      carburant_retour: input.carburantRetour,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  const { error: vehicleError } = await supabase
    .from('vehicles')
    .update({ statut: 'a_inspecter', kilometrage: input.kmRetour })
    .eq('id', vehicleId);
  if (vehicleError) throw vehicleError;

  return fromRow(data as RentalRow);
}

export async function cancelRental(id: string): Promise<Rental> {
  const { data, error } = await getSupabase()
    .from('rentals')
    .update({ statut: 'annulee' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as RentalRow);
}
