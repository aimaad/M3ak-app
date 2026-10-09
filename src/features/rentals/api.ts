import { getCurrentUserId, getSupabase } from '@/lib/supabase';

import type { DepartInput, Rental, RentalInput, RetourInput } from './types';

type RentalRow = {
  id: string;
  agency_id: string;
  numero: string;
  vehicle_id: string;
  customer_id: string;
  driver_id: string | null;
  branch_depart_id: string | null;
  branch_retour_id: string | null;
  lieu_depart: string | null;
  lieu_retour: string | null;
  statut: Rental['statut'];
  date_debut_prevue: string;
  date_fin_prevue: string;
  date_depart_reel: string | null;
  date_retour_reel: string | null;
  km_depart: number | null;
  km_retour: number | null;
  carburant_depart: number | null;
  carburant_retour: number | null;
  duree_jours: number | null;
  prix_jour_applique: number | null;
  sous_total: number | null;
  frais_supplementaires: number;
  remise_montant: number;
  prix_total: number | null;
  devise: string;
  acompte_prevu: number;
  acompte_paye: number;
  statut_paiement: Rental['statutPaiement'];
  caution_montant: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function fromRow(row: RentalRow): Rental {
  return {
    id: row.id,
    agencyId: row.agency_id,
    numero: row.numero,
    vehicleId: row.vehicle_id,
    customerId: row.customer_id,
    driverId: row.driver_id,
    branchDepartId: row.branch_depart_id,
    branchRetourId: row.branch_retour_id,
    lieuDepart: row.lieu_depart,
    lieuRetour: row.lieu_retour,
    statut: row.statut,
    dateDebutPrevue: row.date_debut_prevue,
    dateFinPrevue: row.date_fin_prevue,
    dateDepartReel: row.date_depart_reel,
    dateRetourReel: row.date_retour_reel,
    kmDepart: row.km_depart,
    kmRetour: row.km_retour,
    carburantDepart: row.carburant_depart,
    carburantRetour: row.carburant_retour,
    dureeJours: row.duree_jours,
    prixJourApplique: row.prix_jour_applique != null ? Number(row.prix_jour_applique) : null,
    sousTotal: row.sous_total != null ? Number(row.sous_total) : null,
    fraisSupplementaires: Number(row.frais_supplementaires),
    remiseMontant: Number(row.remise_montant),
    prixTotal: row.prix_total != null ? Number(row.prix_total) : null,
    devise: row.devise,
    acomptePrevu: Number(row.acompte_prevu),
    acomptePaye: Number(row.acompte_paye),
    statutPaiement: row.statut_paiement,
    cautionMontant: Number(row.caution_montant),
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

/**
 * Vérification de disponibilité "optimiste" pour un retour immédiat dans
 * l'interface. La garantie réelle contre les doubles réservations
 * concurrentes est la contrainte d'exclusion PostgreSQL appliquée à
 * l'écriture (voir migrations/0013) : même si cette fonction répond "oui"
 * ici, l'insertion peut encore être refusée si une autre réservation a été
 * confirmée entre-temps — createRental gère ce cas (voir plus bas).
 */
export async function checkVehicleAvailability(
  vehicleId: string,
  startISO: string,
  endISO: string,
  excludeRentalId?: string
): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('check_vehicle_availability', {
    p_vehicle_id: vehicleId,
    p_debut: startISO,
    p_fin: endISO,
    p_exclude_rental_id: excludeRentalId ?? null,
  });
  if (error) throw error;
  return data as boolean;
}

export const RENTAL_CONFLICT_ERROR = 'rental_conflict';
const POSTGRES_EXCLUSION_VIOLATION = '23P01';

function isExclusionViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === POSTGRES_EXCLUSION_VIOLATION
  );
}

/**
 * Le prix (durée, prix/jour appliqué, sous-total, total) est calculé et figé
 * par le serveur à partir des tarifs réels du véhicule (déclencheur
 * `compute_rental_price`, migration 0013) : on n'envoie jamais de montant
 * calculé côté client, pour qu'un appel direct à l'API ne puisse jamais
 * imposer un prix. `frais_supplementaires` et `remise_montant` sont les
 * seuls montants fournis par l'appelant ; ils entrent dans le calcul serveur.
 */
export async function createRental(agencyId: string, input: RentalInput): Promise<Rental> {
  const supabase = getSupabase();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('rentals')
    .insert({
      agency_id: agencyId,
      vehicle_id: input.vehicleId,
      customer_id: input.customerId,
      driver_id: input.driverId,
      branch_depart_id: input.branchDepartId,
      branch_retour_id: input.branchRetourId,
      lieu_depart: input.lieuDepart,
      lieu_retour: input.lieuRetour,
      statut: input.statutInitial,
      date_debut_prevue: input.dateDebutPrevue,
      date_fin_prevue: input.dateFinPrevue,
      frais_supplementaires: input.fraisSupplementaires,
      remise_montant: input.remiseMontant,
      acompte_prevu: input.acomptePrevu,
      caution_montant: input.cautionMontant,
      notes: input.notes,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    if (isExclusionViolation(error)) throw new Error(RENTAL_CONFLICT_ERROR);
    throw error;
  }
  const rental = fromRow(data as RentalRow);

  const { error: depositError } = await supabase.from('deposits').insert({
    agency_id: agencyId,
    rental_id: rental.id,
    montant_bloque: input.cautionMontant,
  });
  if (depositError) throw depositError;

  return rental;
}

export async function updateRentalDates(
  id: string,
  dateDebutPrevue: string,
  dateFinPrevue: string,
  fraisSupplementaires: number,
  remiseMontant: number
): Promise<Rental> {
  const { data, error } = await getSupabase()
    .from('rentals')
    .update({
      date_debut_prevue: dateDebutPrevue,
      date_fin_prevue: dateFinPrevue,
      frais_supplementaires: fraisSupplementaires,
      remise_montant: remiseMontant,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (isExclusionViolation(error)) throw new Error(RENTAL_CONFLICT_ERROR);
    throw error;
  }
  return fromRow(data as RentalRow);
}

export async function confirmRental(id: string): Promise<Rental> {
  const { data, error } = await getSupabase()
    .from('rentals')
    .update({ statut: 'confirmee' })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (isExclusionViolation(error)) throw new Error(RENTAL_CONFLICT_ERROR);
    throw error;
  }
  return fromRow(data as RentalRow);
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
