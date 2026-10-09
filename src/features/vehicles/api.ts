import { uploadFile } from '@/features/storage/api';
import { getSupabase } from '@/lib/supabase';

import { SYSTEM_MANAGED_STATUSES } from './types';
import type {
  Vehicle,
  VehicleDocument,
  VehicleDocumentType,
  VehicleInput,
  VehiclePhoto,
} from './types';

export const VEHICLE_DOCUMENTS_BUCKET = 'vehicle-documents';
export const VEHICLE_PHOTOS_BUCKET = 'vehicle-photos';

type VehicleRow = {
  id: string;
  agency_id: string;
  branch_id: string | null;
  immatriculation: string;
  marque: string;
  modele: string;
  annee: number | null;
  categorie: Vehicle['categorie'];
  couleur: string | null;
  nombre_places: number | null;
  transmission: Vehicle['transmission'];
  carburant: Vehicle['carburant'];
  kilometrage: number;
  niveau_carburant: number | null;
  statut: Vehicle['statut'];
  prix_jour: number;
  prix_semaine: number | null;
  prix_mois: number | null;
  description: string | null;
  photo_url: string | null;
  photos: VehiclePhoto[];
  documents: VehicleDocument[];
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

function fromRow(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    agencyId: row.agency_id,
    branchId: row.branch_id,
    immatriculation: row.immatriculation,
    marque: row.marque,
    modele: row.modele,
    annee: row.annee,
    categorie: row.categorie,
    couleur: row.couleur,
    nombrePlaces: row.nombre_places,
    transmission: row.transmission,
    carburant: row.carburant,
    kilometrage: row.kilometrage,
    niveauCarburant: row.niveau_carburant,
    statut: row.statut,
    prixJour: Number(row.prix_jour),
    prixSemaine: row.prix_semaine !== null ? Number(row.prix_semaine) : null,
    prixMois: row.prix_mois !== null ? Number(row.prix_mois) : null,
    description: row.description,
    photoUrl: row.photo_url,
    photos: row.photos ?? [],
    documents: row.documents ?? [],
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(input: VehicleInput) {
  return {
    marque: input.marque,
    modele: input.modele,
    immatriculation: input.immatriculation,
    annee: input.annee,
    categorie: input.categorie,
    couleur: input.couleur,
    nombre_places: input.nombrePlaces,
    transmission: input.transmission,
    carburant: input.carburant,
    kilometrage: input.kilometrage,
    niveau_carburant: input.niveauCarburant,
    statut: input.statut,
    prix_jour: input.prixJour,
    prix_semaine: input.prixSemaine,
    prix_mois: input.prixMois,
    description: input.description,
  };
}

/**
 * en_location / a_inspecter sont posés par le module locations (départ/retour) :
 * ce chemin (formulaire véhicule) ne doit jamais les écraser à la main.
 */
function assertManuallySettableStatus(statut: VehicleInput['statut']) {
  if (SYSTEM_MANAGED_STATUSES.includes(statut)) {
    throw new Error(`statut_non_modifiable_manuellement: ${statut}`);
  }
}

export async function listVehicles(): Promise<Vehicle[]> {
  const { data, error } = await getSupabase()
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as VehicleRow[]).map(fromRow);
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const { data, error } = await getSupabase().from('vehicles').select('*').eq('id', id).maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as VehicleRow) : null;
}

export async function createVehicle(agencyId: string, input: VehicleInput): Promise<Vehicle> {
  assertManuallySettableStatus(input.statut);

  const { data, error } = await getSupabase()
    .from('vehicles')
    .insert({ ...toRow(input), agency_id: agencyId })
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as VehicleRow);
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<Vehicle> {
  assertManuallySettableStatus(input.statut);

  const { data, error } = await getSupabase()
    .from('vehicles')
    .update(toRow(input))
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as VehicleRow);
}

export async function archiveVehicle(id: string): Promise<Vehicle> {
  const { data, error } = await getSupabase()
    .from('vehicles')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as VehicleRow);
}

export async function reactivateVehicle(id: string): Promise<Vehicle> {
  const { data, error } = await getSupabase()
    .from('vehicles')
    .update({ archived_at: null })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as VehicleRow);
}

export async function updateVehicleDocuments(id: string, documents: VehicleDocument[]): Promise<Vehicle> {
  const { data, error } = await getSupabase()
    .from('vehicles')
    .update({ documents })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as VehicleRow);
}

export async function uploadVehicleDocument(
  agencyId: string,
  vehicleId: string,
  type: VehicleDocumentType,
  localUri: string,
  expiresAt: string | null
): Promise<VehicleDocument> {
  const extension = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
  const path = `${agencyId}/${vehicleId}/${type}-${Date.now()}.${extension}`;

  await uploadFile(VEHICLE_DOCUMENTS_BUCKET, path, localUri, contentType);

  return { type, path, uploadedAt: new Date().toISOString(), expiresAt };
}

export async function updateVehiclePhotos(id: string, photos: VehiclePhoto[]): Promise<Vehicle> {
  const { data, error } = await getSupabase()
    .from('vehicles')
    .update({ photos })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as VehicleRow);
}

export async function uploadVehiclePhoto(
  agencyId: string,
  vehicleId: string,
  localUri: string
): Promise<VehiclePhoto> {
  const extension = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
  const path = `${agencyId}/${vehicleId}/photo-${Date.now()}.${extension}`;

  await uploadFile(VEHICLE_PHOTOS_BUCKET, path, localUri, contentType);

  return { path, uploadedAt: new Date().toISOString() };
}

export async function deleteVehiclePhotoFile(path: string): Promise<void> {
  const { error } = await getSupabase().storage.from(VEHICLE_PHOTOS_BUCKET).remove([path]);
  if (error) throw error;
}
