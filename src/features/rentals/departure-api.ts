import { getSupabase } from '@/lib/supabase';

import {
  DEFAULT_DEPARTURE_POLICY,
  parseDepartureCheck,
  type DepartureCheck,
  type DeparturePolicy,
} from './departure-check';

/** Liste de contrôle du client et de chaque conducteur (règle unique côté serveur). */
export async function getDepartureCheck(rentalId: string): Promise<DepartureCheck> {
  const { data, error } = await getSupabase().rpc('rental_departure_check', { p_rental_id: rentalId });
  if (error) throw new Error(error.message);
  return parseDepartureCheck(data);
}

/** Confirmation humaine, horodatée et attribuée. Le serveur refuse s'il reste un blocage documentaire. */
export async function confirmDepartureCheck(rentalId: string): Promise<DepartureCheck> {
  const { data, error } = await getSupabase().rpc('confirm_rental_departure_check', { p_rental_id: rentalId });
  if (error) throw new Error(error.message);
  return parseDepartureCheck(data);
}

type PolicyRow = {
  block_departure: boolean;
  require_customer_id_document: boolean;
  require_driver_licence: boolean;
  require_licence_valid_until_end: boolean;
  require_manual_confirmation: boolean;
  confirmation_role: 'employee' | 'manager';
  max_additional_drivers: number;
};

export async function getDeparturePolicy(agencyId: string): Promise<DeparturePolicy> {
  const { data, error } = await getSupabase()
    .from('agency_departure_policies')
    .select('*')
    .eq('agency_id', agencyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return DEFAULT_DEPARTURE_POLICY;
  const row = data as PolicyRow;
  return {
    blockDeparture: row.block_departure,
    requireCustomerIdDocument: row.require_customer_id_document,
    requireDriverLicence: row.require_driver_licence,
    requireLicenceValidUntilEnd: row.require_licence_valid_until_end,
    requireManualConfirmation: row.require_manual_confirmation,
    confirmationRole: row.confirmation_role,
    maxAdditionalDrivers: row.max_additional_drivers,
  };
}

/** Réservé au propriétaire (RLS) : ces exigences engagent l'agence, pas l'application. */
export async function saveDeparturePolicy(agencyId: string, policy: DeparturePolicy): Promise<void> {
  const { error } = await getSupabase().from('agency_departure_policies').upsert({
    agency_id: agencyId,
    block_departure: policy.blockDeparture,
    require_customer_id_document: policy.requireCustomerIdDocument,
    require_driver_licence: policy.requireDriverLicence,
    require_licence_valid_until_end: policy.requireLicenceValidUntilEnd,
    require_manual_confirmation: policy.requireManualConfirmation,
    confirmation_role: policy.confirmationRole,
    max_additional_drivers: policy.maxAdditionalDrivers,
  });
  if (error) throw error;
}
