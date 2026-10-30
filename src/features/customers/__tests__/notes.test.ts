import { canEditNote, MAX_NOTE_LENGTH, validateNoteBody } from '../notes';

describe('validateNoteBody', () => {
  it('refuse une note vide ou faite d’espaces', () => {
    expect(validateNoteBody('')).toBe('required');
    expect(validateNoteBody('   \n ')).toBe('required');
  });

  it('refuse une note trop longue', () => {
    expect(validateNoteBody('a'.repeat(MAX_NOTE_LENGTH + 1))).toBe('too_long');
  });

  it('accepte une note normale', () => {
    expect(validateNoteBody('Préfère être appelé le matin')).toBeNull();
  });
});

describe('canEditNote (restrictions d’accès)', () => {
  const note = { createdBy: 'user-1' };

  it("l'auteur peut modifier sa note", () => {
    expect(canEditNote('employee', 'user-1', note)).toBe(true);
  });

  it("un autre employé ne peut pas modifier la note d'un collègue", () => {
    expect(canEditNote('employee', 'user-2', note)).toBe(false);
  });

  it("un responsable et le propriétaire peuvent modifier n'importe quelle note", () => {
    expect(canEditNote('manager', 'user-2', note)).toBe(true);
    expect(canEditNote('owner', 'user-3', note)).toBe(true);
  });

  it('une note importée (auteur inconnu) n’est modifiable que par un responsable', () => {
    expect(canEditNote('employee', 'user-1', { createdBy: null })).toBe(false);
    expect(canEditNote('manager', 'user-1', { createdBy: null })).toBe(true);
  });

  it("sans rôle ou sans utilisateur, aucune modification", () => {
    expect(canEditNote(null, 'user-1', note)).toBe(false);
    expect(canEditNote('employee', null, note)).toBe(false);
  });
});
