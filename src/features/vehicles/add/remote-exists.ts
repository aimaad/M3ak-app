import { getSupabase } from '@/lib/supabase';

import type { ExistingVehicle } from './lookup';
import { formatPlate, vinKey } from './plate';

/**
 * « Ce véhicule existe-t-il déjà, même dans une autre filiale ? » : réponse de la fonction serveur `vehicle_exists` (migration 0066).
 * Elle ne dit que « existe » et le nom de la filiale (null = véhicule sans filiale) : jamais de fiche à ouvrir.
 */
export type RemoteExists = { found: boolean; branchName: string | null };

/** La fonction renvoie une ligne `{ found, branch_name }` (tableau avec un élément, ou objet seul). Toute autre forme est rejetée. */
export function parseRemoteExists(data: unknown): RemoteExists | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (typeof row !== 'object' || row === null) return null;
  const { found, branch_name: branchName } = row as { found?: unknown; branch_name?: unknown };
  if (typeof found !== 'boolean') return null;
  return { found, branchName: found && typeof branchName === 'string' && branchName.trim() ? branchName : null };
}

/**
 * Interroge le serveur avec la plaque (forme enregistrée) et le VIN (normalisé). `null` = vérification indisponible (hors connexion,
 * fonction pas encore déployée, erreur) : l'appelant garde alors son contrôle local, sans jamais déclarer « pas chez vous » à tort.
 */
export async function checkVehicleExists(agencyId: string, candidate: { plate?: string | null; vin?: string | null }): Promise<RemoteExists | null> {
  const plate = candidate.plate?.trim() ? formatPlate(candidate.plate) : null;
  const vin = candidate.vin?.trim() ? vinKey(candidate.vin) : null;
  if (!plate && !vin) return { found: false, branchName: null };
  try {
    const { data, error } = await getSupabase().rpc('vehicle_exists', { p_agency_id: agencyId, p_plate: plate, p_vin: vin });
    if (error) return null;
    return parseRemoteExists(data);
  } catch {
    return null;
  }
}

/** Doublon à signaler : un véhicule visible (on peut ouvrir sa fiche), sinon un véhicule d'une autre filiale (nom seulement). */
export type DuplicateOutcome = ({ kind: 'visible' } & ExistingVehicle) | { kind: 'elsewhere'; branchName: string | null };

export function combineDuplicate(local: ExistingVehicle | null, remote: RemoteExists | null): DuplicateOutcome | null {
  if (local) return { kind: 'visible', ...local };
  if (remote?.found) return { kind: 'elsewhere', branchName: remote.branchName };
  return null;
}
