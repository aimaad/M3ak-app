import type { AgencyRole } from '@/features/agency/types';

/** Note interne confidentielle d'un client : jamais reprise dans un contrat ni un document remis au client. */
export type CustomerNote = {
  id: string;
  agencyId: string;
  customerId: string;
  body: string;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  editedAt: string | null;
};

export type CustomerNoteRevision = {
  id: string;
  noteId: string;
  body: string;
  editedByName: string | null;
  editedAt: string;
};

export const MAX_NOTE_LENGTH = 4000;

export type NoteBodyError = 'required' | 'too_long';

export function validateNoteBody(body: string): NoteBodyError | null {
  const trimmed = body.trim();
  if (!trimmed) return 'required';
  if (trimmed.length > MAX_NOTE_LENGTH) return 'too_long';
  return null;
}

/**
 * Qui peut modifier ou supprimer une note : son auteur, ou un responsable / le propriétaire.
 * Même règle que le déclencheur côté serveur (l'interface ne fait que masquer les boutons).
 */
export function canEditNote(
  role: AgencyRole | null | undefined,
  userId: string | null | undefined,
  note: Pick<CustomerNote, 'createdBy'>
): boolean {
  if (!role) return false;
  if (role === 'owner' || role === 'manager') return true;
  return !!userId && note.createdBy === userId;
}
