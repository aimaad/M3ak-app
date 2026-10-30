import { getCurrentUserId, getSupabase } from '@/lib/supabase';

import type { Damage, DamageBox, DamageComparison, DamageSeverity, DamageStatus, DamageType, DamageZone } from './damages';
import type { Inspection, InspectionPhoto, InspectionType, PhotoAngle } from './types';

const PHOTOS_BUCKET = 'inspection-photos';

type InspectionRow = {
  id: string;
  agency_id: string;
  rental_id: string;
  vehicle_id: string;
  type: InspectionType;
  statut: Inspection['statut'];
  employee_id: string | null;
  date_inspection: string;
  created_at: string;
  kilometrage: number | null;
  niveau_carburant: number | null;
  proprete: Inspection['proprete'];
  analysis_status: Inspection['analysisStatus'];
  analyzed_at: string | null;
  ai_summary: string | null;
  failed_zones: string[] | null;
  skipped?: boolean;
};

type InspectionPhotoRow = {
  id: string;
  inspection_id: string;
  agency_id: string;
  angle: PhotoAngle;
  url: string;
  created_at: string;
};

function fromRow(row: InspectionRow): Inspection {
  return {
    id: row.id,
    agencyId: row.agency_id,
    rentalId: row.rental_id,
    vehicleId: row.vehicle_id,
    type: row.type,
    statut: row.statut,
    employeeId: row.employee_id,
    dateInspection: row.date_inspection,
    createdAt: row.created_at,
    kilometrage: row.kilometrage ?? null,
    niveauCarburant: row.niveau_carburant ?? null,
    proprete: row.proprete ?? null,
    analysisStatus: row.analysis_status ?? 'aucune',
    analyzedAt: row.analyzed_at ?? null,
    aiSummary: row.ai_summary ?? null,
    failedZones: row.failed_zones ?? [],
    skipped: row.skipped ?? false,
  };
}

function photoFromRow(row: InspectionPhotoRow): InspectionPhoto {
  return {
    id: row.id,
    inspectionId: row.inspection_id,
    agencyId: row.agency_id,
    angle: row.angle,
    url: row.url,
    createdAt: row.created_at,
  };
}

export async function getInspectionForRental(
  rentalId: string,
  type: InspectionType
): Promise<Inspection | null> {
  const { data, error } = await getSupabase()
    .from('inspections')
    .select('*')
    .eq('rental_id', rentalId)
    .eq('type', type)
    .maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as InspectionRow) : null;
}

export async function createInspection(
  agencyId: string,
  rentalId: string,
  vehicleId: string,
  type: InspectionType
): Promise<Inspection> {
  const supabase = getSupabase();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('inspections')
    .insert({
      agency_id: agencyId,
      rental_id: rentalId,
      vehicle_id: vehicleId,
      type,
      employee_id: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as InspectionRow);
}

/**
 * Ignore l'inspection (aucune photo) : l'inspection est marquée terminée ET ignorée, avec qui et quand (posés par le
 * serveur). Si elle existe déjà (sans photo), elle est mise à jour ; sinon elle est créée directement ignorée.
 */
export async function skipInspection(agencyId: string, rentalId: string, vehicleId: string, type: InspectionType): Promise<Inspection> {
  const existing = await getInspectionForRental(rentalId, type);
  if (existing) {
    const { data, error } = await getSupabase().from('inspections').update({ skipped: true, statut: 'terminee' }).eq('id', existing.id).select().single();
    if (error) throw error;
    return fromRow(data as InspectionRow);
  }
  const userId = await getCurrentUserId();
  const { data, error } = await getSupabase()
    .from('inspections')
    .insert({ agency_id: agencyId, rental_id: rentalId, vehicle_id: vehicleId, type, employee_id: userId, skipped: true, statut: 'terminee' })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as InspectionRow);
}

/** L'employé change d'avis : l'inspection ignorée redevient une inspection à faire. */
export async function resumeInspection(id: string): Promise<Inspection> {
  const { data, error } = await getSupabase().from('inspections').update({ skipped: false, statut: 'en_cours' }).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data as InspectionRow);
}

/** L'employé décline l'analyse par M3ak : les photos restent stockées (inspection et comparaison au retour). */
export async function declineAnalysis(id: string): Promise<Inspection> {
  const { data, error } = await getSupabase().from('inspections').update({ analysis_status: 'refusee' }).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data as InspectionRow);
}

export async function completeInspection(id: string): Promise<Inspection> {
  const { data, error } = await getSupabase()
    .from('inspections')
    .update({ statut: 'terminee' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as InspectionRow);
}

export async function listInspectionPhotos(inspectionId: string): Promise<InspectionPhoto[]> {
  const { data, error } = await getSupabase()
    .from('inspection_photos')
    .select('*')
    .eq('inspection_id', inspectionId);

  if (error) throw error;
  return (data as InspectionPhotoRow[]).map(photoFromRow);
}

export async function uploadInspectionPhoto(
  agencyId: string,
  inspectionId: string,
  angle: PhotoAngle,
  localUri: string
): Promise<InspectionPhoto> {
  const supabase = getSupabase();
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();
  const path = `${agencyId}/${inspectionId}/${angle}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('inspection_photos')
    .upsert(
      { inspection_id: inspectionId, agency_id: agencyId, angle, url: path },
      { onConflict: 'inspection_id,angle' }
    )
    .select()
    .single();
  if (error) throw error;

  return photoFromRow(data as InspectionPhotoRow);
}

export async function getPhotoSignedUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase()
    .storage.from(PHOTOS_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error) throw error;
  return data.signedUrl;
}

type DamageRow = {
  id: string;
  inspection_id: string;
  photo_id: string | null;
  angle: PhotoAngle | null;
  zone: DamageZone;
  type: DamageType;
  gravite: DamageSeverity;
  confiance: number | string | null;
  nouveau: boolean;
  description: string | null;
  cout_estime: number | string | null;
  cout_valide: number | string | null;
  bbox: DamageBox | null;
  comparaison: DamageComparison;
  statut: DamageStatus;
  source: 'ia' | 'manuel';
  dans_contrat?: boolean;
};

function damageFromRow(row: DamageRow): Damage {
  return {
    id: row.id,
    inspectionId: row.inspection_id,
    photoId: row.photo_id,
    angle: row.angle,
    zone: row.zone,
    type: row.type,
    gravite: row.gravite,
    confiance: row.confiance === null ? null : Number(row.confiance),
    nouveau: row.nouveau,
    description: row.description,
    coutEstime: row.cout_estime === null ? null : Number(row.cout_estime),
    coutValide: row.cout_valide === null ? null : Number(row.cout_valide),
    bbox: row.bbox,
    comparaison: row.comparaison,
    statut: row.statut,
    source: row.source,
    dansContrat: row.dans_contrat ?? true,
  };
}

export async function listDamages(inspectionId: string): Promise<Damage[]> {
  const { data, error } = await getSupabase().from('damages').select('*').eq('inspection_id', inspectionId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data as DamageRow[]).map(damageFromRow);
}

export type DamagePatch = Partial<{
  statut: DamageStatus;
  zone: DamageZone;
  type: DamageType;
  gravite: DamageSeverity;
  nouveau: boolean;
  description: string | null;
  coutValide: number | null;
  dansContrat: boolean;
}>;

/** Décision de l'employé sur un dommage : confirmer, rejeter ou corriger (zone, type, gravité, coût, nouveau ou existant). */
export async function updateDamage(id: string, patch: DamagePatch): Promise<Damage> {
  const userId = await getCurrentUserId();
  const { data, error } = await getSupabase()
    .from('damages')
    .update({
      ...(patch.statut !== undefined ? { statut: patch.statut, valide_par_employe: patch.statut === 'confirme' } : {}),
      ...(patch.zone !== undefined ? { zone: patch.zone } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.gravite !== undefined ? { gravite: patch.gravite } : {}),
      ...(patch.nouveau !== undefined ? { nouveau: patch.nouveau } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.coutValide !== undefined ? { cout_valide: patch.coutValide } : {}),
      ...(patch.dansContrat !== undefined ? { dans_contrat: patch.dansContrat } : {}),
      valide_par: userId,
      valide_le: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return damageFromRow(data as DamageRow);
}

export type ManualDamageInput = {
  zone: DamageZone;
  type: DamageType;
  gravite: DamageSeverity;
  nouveau: boolean;
  description: string | null;
  cout: number | null;
  angle: PhotoAngle | null;
  photoId: string | null;
};

/** Dommage que l'IA n'a pas vu : ajouté par l'employé, déjà confirmé. */
export async function createManualDamage(agencyId: string, inspectionId: string, input: ManualDamageInput): Promise<Damage> {
  const userId = await getCurrentUserId();
  const { data, error } = await getSupabase()
    .from('damages')
    .insert({
      inspection_id: inspectionId,
      agency_id: agencyId,
      photo_id: input.photoId,
      angle: input.angle,
      zone: input.zone,
      type: input.type,
      gravite: input.gravite,
      nouveau: input.nouveau,
      description: input.description,
      cout_estime: input.cout,
      cout_valide: input.cout,
      comparaison: 'retour_seul',
      statut: 'confirme',
      source: 'manuel',
      valide_par_employe: true,
      valide_par: userId,
      valide_le: new Date().toISOString(),
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return damageFromRow(data as DamageRow);
}
