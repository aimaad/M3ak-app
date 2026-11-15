import type { Vehicle } from '../../types';
import { draftOf, emptyDraft, planDueSave, validateDue, type DueDraft } from '../dues-edit';
import type { DueRow } from '../dues';

const vehicle = { kilometrage: 59_000, documents: [] } as unknown as Vehicle;
const withDoc = { kilometrage: 59_000, documents: [{ type: 'assurance', path: 'p', uploadedAt: '2026-01-01', expiresAt: '2026-12-26' }] } as unknown as Vehicle;
const draft = (extra: Partial<DueDraft> = {}): DueDraft => ({ ...emptyDraft(), ...extra });

describe('un nouveau brouillon est VIDE : aucune valeur prédéfinie', () => {
  it('ni date, ni kilométrage, ni périodicité', () => {
    expect(emptyDraft()).toEqual({ date: '', km: '', notes: '', repeat: false, repeatKm: '', repeatMonths: '' });
  });
});

describe('validation d’une échéance', () => {
  it('au moins une date ou un kilométrage', () => {
    expect(validateDue(emptyDraft())).toEqual({ date: 'need_one' });
  });
  it('date JJ/MM/AAAA valide ; kilométrage positif', () => {
    expect(validateDue(draft({ date: '26/12/2026' }))).toEqual({});
    expect(validateDue(draft({ date: '32/13/2026' }))).toEqual({ date: 'invalid_date' });
    expect(validateDue(draft({ km: '-4' }))).toEqual({ km: 'invalid_number' });
    expect(validateDue(draft({ km: '70000' }))).toEqual({});
  });
  it('le brouillon d’une ligne reprend sa date (JJ/MM/AAAA) et son kilométrage', () => {
    expect(draftOf({ date: '2026-12-26', targetKm: 70_000 } as DueRow)).toEqual({ date: '26/12/2026', km: '70000', notes: '', repeat: false, repeatKm: '', repeatMonths: '' });
  });
});

describe('« se répète » : kilométrage et/ou mois, au moins un', () => {
  const base = { km: '70000' };
  it('« se répète » sans rien indiquer : refusé avec un message qui dit quoi faire', () => {
    expect(validateDue(draft({ ...base, repeat: true }))).toEqual({ repeat: 'need_one_repeat' });
  });
  it('un seul des deux suffit (l’autre est désactivé)', () => {
    expect(validateDue(draft({ ...base, repeat: true, repeatKm: '10000' }))).toEqual({});
    expect(validateDue(draft({ ...base, repeat: true, repeatMonths: '12' }))).toEqual({});
    expect(validateDue(draft({ ...base, repeat: true, repeatKm: '10000', repeatMonths: '12' }))).toEqual({});
  });
  it('valeurs absurdes refusées (0, négatif, décimal, trop grand)', () => {
    expect(validateDue(draft({ ...base, repeat: true, repeatKm: '0' }))).toEqual({ repeatKm: 'invalid_number' });
    expect(validateDue(draft({ ...base, repeat: true, repeatMonths: '0' }))).toEqual({ repeatMonths: 'invalid_number' });
    expect(validateDue(draft({ ...base, repeat: true, repeatMonths: '500' }))).toEqual({ repeatMonths: 'invalid_number' });
  });
  it('« une seule fois » : une périodicité restée dans les champs est ignorée', () => {
    expect(validateDue(draft({ ...base, repeat: false, repeatKm: '0' }))).toEqual({});
    expect(planDueSave({ type: 'vidange' }, vehicle, draft({ ...base, repeat: false, repeatKm: '10000', repeatMonths: '12' })).createItem).toMatchObject({ repeatKm: null, repeatMonths: null });
  });
});

describe('plan d’enregistrement', () => {
  const d = draft({ date: '31/01/2027', notes: ' RAS ' });

  it('ligne venant d’un entretien : mise à jour de l’entretien', () => {
    expect(planDueSave({ type: 'vidange', maintenanceId: 'm1' }, vehicle, draft({ km: '70000' }))).toEqual({
      updateItem: { id: 'm1', echeanceDate: null, echeanceKm: 70000, notes: null, repeatKm: null, repeatMonths: null }, createItem: null, syncDocumentExpiry: null,
    });
  });

  it('périodicité enregistrée avec l’échéance (nouvelle ou existante)', () => {
    const periodic = draft({ km: '70000', repeat: true, repeatKm: '10000', repeatMonths: '12' });
    expect(planDueSave({ type: 'vidange', maintenanceId: 'm1' }, vehicle, periodic).updateItem).toMatchObject({ repeatKm: 10000, repeatMonths: 12 });
    expect(planDueSave({ type: 'vidange' }, vehicle, periodic).createItem).toMatchObject({ repeatKm: 10000, repeatMonths: 12 });
  });

  it('un seul compteur : l’autre reste vide', () => {
    expect(planDueSave({ type: 'vidange' }, vehicle, draft({ km: '70000', repeat: true, repeatMonths: '6' })).createItem).toMatchObject({ repeatKm: null, repeatMonths: 6 });
  });

  it('une panne ne se répète jamais', () => {
    expect(planDueSave({ type: 'panne' }, vehicle, draft({ km: '70000', repeat: true, repeatKm: '10000' })).createItem).toMatchObject({ repeatKm: null, repeatMonths: null });
  });

  it('assurance avec document ET entretien : les deux dates restent d’accord', () => {
    const plan = planDueSave({ type: 'assurance', maintenanceId: 'm2' }, withDoc, d);
    expect(plan.updateItem).toMatchObject({ id: 'm2', echeanceDate: '2027-01-31', notes: 'RAS' });
    expect(plan.syncDocumentExpiry).toEqual({ type: 'assurance', expiresAt: '2027-01-31' });
  });

  it('assurance qui ne vient que du document : seule la date du document change, pas de doublon', () => {
    expect(planDueSave({ type: 'assurance' }, withDoc, d)).toEqual({ updateItem: null, createItem: null, syncDocumentExpiry: { type: 'assurance', expiresAt: '2027-01-31' } });
  });

  it('ligne sans entretien ni document : l’échéance est créée', () => {
    expect(planDueSave({ type: 'visite_technique' }, vehicle, d)).toEqual({
      updateItem: null, createItem: { type: 'visite_technique', echeanceDate: '2027-01-31', echeanceKm: null, notes: 'RAS', repeatKm: null, repeatMonths: null }, syncDocumentExpiry: null,
    });
  });
});
