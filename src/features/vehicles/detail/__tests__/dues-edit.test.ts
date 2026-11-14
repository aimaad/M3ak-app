import type { Vehicle } from '../../types';
import { defaultRepeat, draftOf, dueSuggestion, emptyDraft, newDraft, planDueSave, validateDue } from '../dues-edit';
import type { DueRow } from '../dues';

const NOW = new Date(2026, 10, 15, 12);
const vehicle = { kilometrage: 59_000, documents: [] } as unknown as Vehicle;
const withDoc = { kilometrage: 59_000, documents: [{ type: 'assurance', path: 'p', uploadedAt: '2026-01-01', expiresAt: '2026-12-26' }] } as unknown as Vehicle;

describe('suggestions d’échéance', () => {
  it('assurance et visite : dans 12 mois', () => {
    expect(dueSuggestion('assurance', vehicle, NOW)).toEqual({ date: '2027-11-15', km: null });
    expect(dueSuggestion('visite_technique', vehicle, NOW)).toEqual({ date: '2027-11-15', km: null });
  });
  it('vidange : +10 000 km ou 12 mois ; freins +30 000 ; pneus +40 000 ; autre : rien', () => {
    expect(dueSuggestion('vidange', vehicle, NOW)).toEqual({ date: '2027-11-15', km: 69_000 });
    expect(dueSuggestion('freins', vehicle, NOW)).toEqual({ date: null, km: 89_000 });
    expect(dueSuggestion('pneus', vehicle, NOW)).toEqual({ date: null, km: 99_000 });
    expect(dueSuggestion('autre', vehicle, NOW)).toEqual({ date: null, km: null });
  });
});

describe('validation d’une échéance', () => {
  it('au moins une date ou un kilométrage', () => {
    expect(validateDue(emptyDraft())).toEqual({ date: 'need_one' });
  });
  it('date JJ/MM/AAAA valide ; kilométrage positif', () => {
    expect(validateDue({ date: '26/12/2026', km: '', notes: '', repeatKm: '', repeatMonths: '' })).toEqual({});
    expect(validateDue({ date: '32/13/2026', km: '', notes: '', repeatKm: '', repeatMonths: '' })).toEqual({ date: 'invalid_date' });
    expect(validateDue({ date: '', km: '-4', notes: '', repeatKm: '', repeatMonths: '' })).toEqual({ km: 'invalid_number' });
    expect(validateDue({ date: '', km: '70000', notes: '', repeatKm: '', repeatMonths: '' })).toEqual({});
  });
  it('le brouillon d’une ligne reprend sa date (JJ/MM/AAAA) et son kilométrage', () => {
    expect(draftOf({ date: '2026-12-26', targetKm: 70_000 } as DueRow)).toEqual({ date: '26/12/2026', km: '70000', notes: '', repeatKm: '', repeatMonths: '' });
  });
});

describe('plan d’enregistrement', () => {
  const draft = { date: '31/01/2027', km: '', notes: ' RAS ', repeatKm: '', repeatMonths: '' };

  it('ligne venant d’un entretien : mise à jour de l’entretien', () => {
    expect(planDueSave({ type: 'vidange', maintenanceId: 'm1' }, vehicle, { date: '', km: '70000', notes: '', repeatKm: '', repeatMonths: '' })).toEqual({
      updateItem: { id: 'm1', echeanceDate: null, echeanceKm: 70000, notes: null, repeatKm: null, repeatMonths: null }, createItem: null, syncDocumentExpiry: null,
    });
  });

  it('assurance avec document ET entretien : les deux dates restent d’accord', () => {
    const plan = planDueSave({ type: 'assurance', maintenanceId: 'm2' }, withDoc, draft);
    expect(plan.updateItem).toMatchObject({ id: 'm2', echeanceDate: '2027-01-31', notes: 'RAS' });
    expect(plan.syncDocumentExpiry).toEqual({ type: 'assurance', expiresAt: '2027-01-31' });
  });

  it('assurance qui ne vient que du document : seule la date du document change, pas de doublon', () => {
    expect(planDueSave({ type: 'assurance' }, withDoc, draft)).toEqual({ updateItem: null, createItem: null, syncDocumentExpiry: { type: 'assurance', expiresAt: '2027-01-31' } });
  });

  it('ligne sans entretien ni document : l’échéance est créée', () => {
    expect(planDueSave({ type: 'visite_technique' }, vehicle, draft)).toEqual({
      updateItem: null, createItem: { type: 'visite_technique', echeanceDate: '2027-01-31', echeanceKm: null, notes: 'RAS', repeatKm: null, repeatMonths: null }, syncDocumentExpiry: null,
    });
  });
});

describe('échéances périodiques', () => {
  it('périodicité d’usage : vidange 10 000 km / 12 mois, freins 30 000, pneus 40 000, autre rien', () => {
    expect(defaultRepeat('vidange')).toEqual({ km: 10_000, months: 12 });
    expect(defaultRepeat('freins')).toEqual({ km: 30_000, months: null });
    expect(defaultRepeat('pneus')).toEqual({ km: 40_000, months: null });
    expect(defaultRepeat('autre')).toEqual({ km: null, months: null });
  });

  it('un nouveau brouillon reprend la périodicité du type : rien à retaper', () => {
    expect(newDraft('vidange')).toMatchObject({ repeatKm: '10000', repeatMonths: '12', date: '', km: '' });
    expect(newDraft('autre')).toMatchObject({ repeatKm: '', repeatMonths: '' });
  });

  it('périodicité enregistrée avec l’échéance (nouvelle ou existante)', () => {
    const draft = { date: '', km: '70000', notes: '', repeatKm: '10000', repeatMonths: '12' };
    expect(planDueSave({ type: 'vidange', maintenanceId: 'm1' }, vehicle, draft).updateItem).toMatchObject({ repeatKm: 10000, repeatMonths: 12 });
    expect(planDueSave({ type: 'vidange' }, vehicle, draft).createItem).toMatchObject({ repeatKm: 10000, repeatMonths: 12 });
  });

  it('une périodicité vide = pas de répétition', () => {
    const plan = planDueSave({ type: 'freins' }, vehicle, { date: '', km: '70000', notes: '', repeatKm: '', repeatMonths: '' });
    expect(plan.createItem).toMatchObject({ repeatKm: null, repeatMonths: null });
  });

  it('une panne ou un document ne se répète pas', () => {
    const plan = planDueSave({ type: 'panne' }, vehicle, { date: '', km: '70000', notes: '', repeatKm: '10000', repeatMonths: '12' });
    expect(plan.createItem).toMatchObject({ repeatKm: null, repeatMonths: null });
  });

  it('périodicité en km invalide (0, négatif, décimal) refusée', () => {
    const base = { date: '', km: '70000', notes: '', repeatMonths: '' };
    expect(validateDue({ ...base, repeatKm: '0' })).toEqual({ repeatKm: 'invalid_number' });
    expect(validateDue({ ...base, repeatKm: '-5' })).toEqual({ repeatKm: 'invalid_number' });
    expect(validateDue({ ...base, repeatKm: '10000' })).toEqual({});
  });
});
