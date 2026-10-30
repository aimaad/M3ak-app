import { getSupabase } from '@/lib/supabase';

import type { CustomerNote, CustomerNoteRevision } from './notes';

type NoteRow = {
  id: string;
  agency_id: string;
  customer_id: string;
  body: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  edited_at: string | null;
};

const NOTE_COLUMNS = 'id, agency_id, customer_id, body, created_by, created_by_name, created_at, edited_at';

function noteFromRow(row: NoteRow): CustomerNote {
  return {
    id: row.id,
    agencyId: row.agency_id,
    customerId: row.customer_id,
    body: row.body,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  };
}

/** Notes actives d'un client, de la plus récente à la plus ancienne. Réservées à l'agence propriétaire (RLS). */
export async function listCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  const { data, error } = await getSupabase()
    .from('customer_notes')
    .select(NOTE_COLUMNS)
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as NoteRow[]).map(noteFromRow);
}

/** L'auteur et la date sont fixés par le serveur : on n'envoie que le texte. */
export async function addCustomerNote(agencyId: string, customerId: string, body: string): Promise<CustomerNote> {
  const { data, error } = await getSupabase()
    .from('customer_notes')
    .insert({ agency_id: agencyId, customer_id: customerId, body: body.trim() })
    .select(NOTE_COLUMNS)
    .single();

  if (error) throw error;
  return noteFromRow(data as NoteRow);
}

/** L'ancienne version est conservée automatiquement dans l'historique (déclencheur serveur). */
export async function updateCustomerNote(id: string, body: string): Promise<CustomerNote> {
  const { data, error } = await getSupabase()
    .from('customer_notes')
    .update({ body: body.trim() })
    .eq('id', id)
    .select(NOTE_COLUMNS)
    .single();

  if (error) throw error;
  return noteFromRow(data as NoteRow);
}

/** Suppression douce : la note disparaît de la liste mais son historique reste en base. */
export async function deleteCustomerNote(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('customer_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function listNoteRevisions(noteId: string): Promise<CustomerNoteRevision[]> {
  const { data, error } = await getSupabase()
    .from('customer_note_revisions')
    .select('id, note_id, body, edited_by_name, edited_at')
    .eq('note_id', noteId)
    .order('edited_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    noteId: row.note_id,
    body: row.body,
    editedByName: row.edited_by_name,
    editedAt: row.edited_at,
  }));
}
