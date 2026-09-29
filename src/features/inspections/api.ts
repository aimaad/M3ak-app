import { getSupabase } from '@/lib/supabase';

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
  const { data: userResult } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('inspections')
    .insert({
      agency_id: agencyId,
      rental_id: rentalId,
      vehicle_id: vehicleId,
      type,
      employee_id: userResult.user?.id ?? null,
    })
    .select()
    .single();

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
