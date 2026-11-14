import * as ImageManipulator from 'expo-image-manipulator';

import { uploadFile, uploadFileWithProgress } from '@/features/storage/api';
import { getSupabase } from '@/lib/supabase';

import { SYSTEM_MANAGED_STATUSES } from './types';
import type {
  PhotoAngle,
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
  vin: string | null;
  marque: string;
  modele: string;
  finition: string | null;
  annee: number | null;
  date_mise_en_circulation: string | null;
  puissance_fiscale: number | null;
  categorie: Vehicle['categorie'];
  couleur: string | null;
  nombre_places: number | null;
  transmission: Vehicle['transmission'];
  carburant: Vehicle['carburant'];
  kilometrage: number;
  niveau_carburant: number | null;
  statut: Vehicle['statut'];
  statut_motif?: string | null;
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
    vin: row.vin,
    marque: row.marque,
    modele: row.modele,
    finition: row.finition,
    annee: row.annee,
    dateMiseEnCirculation: row.date_mise_en_circulation ?? null,
    puissanceFiscale: row.puissance_fiscale ?? null,
    categorie: row.categorie,
    couleur: row.couleur,
    nombrePlaces: row.nombre_places,
    transmission: row.transmission,
    carburant: row.carburant,
    kilometrage: row.kilometrage,
    niveauCarburant: row.niveau_carburant,
    statut: row.statut,
    statutMotif: row.statut_motif ?? null,
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
    vin: input.vin,
    finition: input.finition,
    annee: input.annee,
    date_mise_en_circulation: input.dateMiseEnCirculation ?? null,
    puissance_fiscale: input.puissanceFiscale ?? null,
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
    ...(input.branchId !== undefined ? { branch_id: input.branchId } : {}),
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

/**
 * Vérification amont (avant soumission) d'un doublon d'immatriculation ou de
 * VIN dans l'agence — la contrainte unique en base reste le garde-fou
 * définitif (voir isDuplicatePlateError / duplicateVehicleField), ceci n'est
 * qu'un retour rapide côté UI pour éviter une erreur après coup.
 */
export async function findDuplicateVehicle(
  agencyId: string,
  immatriculation: string,
  vin: string | null
): Promise<{ field: 'immatriculation' | 'vin'; vehicle: Vehicle } | null> {
  const { data: byPlate, error: plateError } = await getSupabase()
    .from('vehicles')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('immatriculation', immatriculation)
    .maybeSingle();
  if (plateError) throw plateError;
  if (byPlate) return { field: 'immatriculation', vehicle: fromRow(byPlate as VehicleRow) };

  if (vin) {
    const { data: byVin, error: vinError } = await getSupabase()
      .from('vehicles')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('vin', vin)
      .maybeSingle();
    if (vinError) throw vinError;
    if (byVin) return { field: 'vin', vehicle: fromRow(byVin as VehicleRow) };
  }

  return null;
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

/**
 * Rend un véhicule disponible ou indisponible (avec un motif facultatif de 200 caractères). Seuls les statuts réglables à la main sont permis ;
 * le motif n'a de sens que pour « indisponible » (la base l'efface sinon).
 */
export async function updateVehicleStatus(id: string, statut: VehicleInput['statut'], motif?: string | null): Promise<Vehicle> {
  assertManuallySettableStatus(statut);
  const reason = statut === 'indisponible' ? (motif?.trim().slice(0, 200) || null) : null;
  const { data, error } = await getSupabase().from('vehicles').update({ statut, statut_motif: reason }).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data as VehicleRow);
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<Vehicle> {
  // Un statut géré par le module locations (en location, à inspecter) n'est jamais écrasé à la main : on le laisse tel quel et on
  // enregistre le reste (avant, toute modification d'un véhicule en location échouait).
  const row = toRow(input);
  const { statut, ...withoutStatus } = row;
  const payload = SYSTEM_MANAGED_STATUSES.includes(input.statut) ? withoutStatus : { ...withoutStatus, statut };

  const { data, error } = await getSupabase()
    .from('vehicles')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as VehicleRow);
}

/** Prix par jour seul (modification sur place depuis la fiche) : rien d'autre n'est touché. */
export async function updateVehiclePrice(id: string, prixJour: number): Promise<Vehicle> {
  const { data, error } = await getSupabase().from('vehicles').update({ prix_jour: prixJour }).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data as VehicleRow);
}

export type VehicleSpecsPatch = Partial<Pick<VehicleInput, 'categorie' | 'transmission' | 'carburant' | 'kilometrage' | 'couleur' | 'annee' | 'nombrePlaces' | 'puissanceFiscale'>>;

/**
 * Modification de la fiche technique sur place : seules les colonnes de la fiche technique changent (ni statut, ni prix, ni immatriculation).
 * Contrairement à `updateVehicle`, elle marche aussi pour un véhicule en location ou à inspecter.
 */
export async function updateVehicleSpecs(id: string, patch: VehicleSpecsPatch): Promise<Vehicle> {
  const row = {
    ...(patch.categorie !== undefined ? { categorie: patch.categorie } : {}),
    ...(patch.transmission !== undefined ? { transmission: patch.transmission } : {}),
    ...(patch.carburant !== undefined ? { carburant: patch.carburant } : {}),
    ...(patch.kilometrage !== undefined ? { kilometrage: patch.kilometrage } : {}),
    ...(patch.couleur !== undefined ? { couleur: patch.couleur } : {}),
    ...(patch.annee !== undefined ? { annee: patch.annee } : {}),
    ...(patch.nombrePlaces !== undefined ? { nombre_places: patch.nombrePlaces } : {}),
    ...(patch.puissanceFiscale !== undefined ? { puissance_fiscale: patch.puissanceFiscale } : {}),
  };
  const { data, error } = await getSupabase().from('vehicles').update(row).eq('id', id).select().single();
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

/** Côté le plus long d'une photo de véhicule envoyée : assez net pour la fiche et la galerie, léger pour une connexion moyenne. */
export const VEHICLE_PHOTO_MAX_SIDE = 1600;

/** Photo réduite (1600 px, JPEG 0,8) ; si la réduction échoue, la photo d'origine est envoyée telle quelle. */
export async function prepareVehiclePhoto(localUri: string): Promise<string> {
  try {
    const info = await ImageManipulator.manipulateAsync(localUri, [], {});
    const actions = Math.max(info.width, info.height) > VEHICLE_PHOTO_MAX_SIDE ? [{ resize: info.width >= info.height ? { width: VEHICLE_PHOTO_MAX_SIDE } : { height: VEHICLE_PHOTO_MAX_SIDE } }] : [];
    return (await ImageManipulator.manipulateAsync(localUri, actions, { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG })).uri;
  } catch {
    return localUri;
  }
}

/** Envoie la photo (réduite) avec la progression et renvoie l'entrée à ajouter à la liste, avec son angle. */
export async function uploadVehiclePhotoWithAngle(
  agencyId: string,
  vehicleId: string,
  localUri: string,
  angle: PhotoAngle,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal
): Promise<VehiclePhoto> {
  const prepared = await prepareVehiclePhoto(localUri);
  const path = `${agencyId}/${vehicleId}/photo-${Date.now()}.jpg`;
  await uploadFileWithProgress(VEHICLE_PHOTOS_BUCKET, path, prepared, 'image/jpeg', (progress) => onProgress(progress.fraction), signal);
  return { path, uploadedAt: new Date().toISOString(), angle };
}

export async function deleteVehiclePhotoFile(path: string): Promise<void> {
  const { error } = await getSupabase().storage.from(VEHICLE_PHOTOS_BUCKET).remove([path]);
  if (error) throw error;
}
