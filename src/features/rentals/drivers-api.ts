import { createDriver, driverFromRow, ensureCustomerDriver } from '@/features/customers/api';
import type { Driver } from '@/features/customers/types';
import { getSupabase } from '@/lib/supabase';

import type { RentalDriversSelection } from './rental-drivers';

const DRIVER_COLUMNS =
  'id, agency_id, customer_id, linked_customer_id, nom_complet, prenom, nom, cin_ou_passeport, numero_permis, telephone, created_at';

type DriverRow = Parameters<typeof driverFromRow>[0];

/** Conducteurs supplémentaires déjà associés à une réservation. */
export async function listRentalAdditionalDrivers(rentalId: string): Promise<Driver[]> {
  const { data, error } = await getSupabase()
    .from('rental_additional_drivers')
    .select(`driver:drivers(${DRIVER_COLUMNS})`)
    .eq('rental_id', rentalId);

  if (error) throw error;
  type Row = { driver: DriverRow | DriverRow[] | null };
  return ((data ?? []) as Row[])
    .map((row) => (Array.isArray(row.driver) ? row.driver[0] : row.driver))
    .filter((row): row is DriverRow => !!row)
    .map(driverFromRow);
}

export async function getDriverById(id: string): Promise<Driver | null> {
  const { data, error } = await getSupabase().from('drivers').select(DRIVER_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? driverFromRow(data as DriverRow) : null;
}

/**
 * Enregistre les conducteurs d'une réservation en réutilisant les fiches existantes :
 * - conducteur déjà enregistré → son identifiant ;
 * - client existant → sa ligne « conducteur lié » (créée une seule fois) ;
 * - nouveau conducteur → créé sous le client qui réserve.
 * Puis écrit principal + supplémentaires d'un seul bloc (RPC set_rental_drivers), qui refuse
 * doublons, dépassement du maximum et réservation déjà commencée.
 */
export async function saveRentalDrivers(
  agencyId: string,
  customerId: string,
  rentalId: string,
  selection: RentalDriversSelection
): Promise<void> {
  async function resolveDriverId(candidate: RentalDriversSelection['additional'][number]): Promise<string> {
    if (candidate.driverId) return candidate.driverId;
    if (candidate.kind === 'customer' && candidate.customerId) return ensureCustomerDriver(candidate.customerId);
    if (candidate.kind === 'new' && candidate.draft) {
      const driver = await createDriver(agencyId, customerId, candidate.draft);
      return driver.id;
    }
    throw new Error('driver_unresolvable');
  }

  const principalId = selection.principal ? await resolveDriverId(selection.principal) : null;
  const additionalIds: string[] = [];
  for (const candidate of selection.additional) {
    additionalIds.push(await resolveDriverId(candidate));
  }

  const { error } = await getSupabase().rpc('set_rental_drivers', {
    p_rental_id: rentalId,
    p_principal: principalId,
    p_additional: additionalIds,
  });
  if (error) throw new Error(error.message);
}
