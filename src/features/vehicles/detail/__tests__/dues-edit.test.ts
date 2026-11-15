import type { Vehicle } from '../../types';
import { computeNext, draftOf, dueAlreadyPassed, effectiveDue, emptyDraft, planDueSave, validateDue, type DueDraft } from '../dues-edit';
import type { DueRow } from '../dues';

const vehicle = { kilometrage: 59_000, documents: [] } as unknown as Vehicle;
const withDoc = { kilometrage: 59_000, documents: [{ type: 'assurance', path: 'p', uploadedAt: '2026-01-01', expiresAt: '2026-12-26' }] } as unknown as Vehicle;
const draft = (extra: Partial<DueDraft> = {}): DueDraft => ({ ...emptyDraft(), ...extra });

describe('un nouveau brouillon est VIDE : aucune valeur prédéfinie', () => {
  it('ni date, ni kilométrage, ni périodicité', () => {
    expect(emptyDraft()).toEqual({ date: '', km: '', notes: '', titre: '', repeat: false, repeatKm: '', repeatMonths: '', lastDate: '', lastKm: '' });
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
    expect(draftOf({ date: '2026-12-26', targetKm: 70_000 } as DueRow)).toEqual({ ...emptyDraft(), date: '26/12/2026', km: '70000' });
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
      updateItem: { id: 'm1', echeanceDate: null, echeanceKm: 70000, notes: null, titre: null, repeatKm: null, repeatMonths: null }, createItem: null, syncDocumentExpiry: null,
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
      updateItem: null, createItem: { type: 'visite_technique', echeanceDate: '2027-01-31', echeanceKm: null, notes: 'RAS', titre: null, repeatKm: null, repeatMonths: null }, syncDocumentExpiry: null,
    });
  });
});

describe('« dernière fois faite » : la prochaine échéance se calcule', () => {
  const periodic = (extra: Partial<DueDraft>) => draft({ repeat: true, repeatKm: '10000', repeatMonths: '12', ...extra });

  it('dernier km + tous les N km ; dernière date + tous les N mois', () => {
    expect(computeNext(periodic({ lastKm: '48200', lastDate: '14/11/2026' }))).toEqual({ km: 58200, date: '2027-11-14' });
  });
  it('un seul compteur : l’autre reste vide (désactivé)', () => {
    expect(computeNext(draft({ repeat: true, repeatKm: '10000', lastKm: '48200', lastDate: '14/11/2026' }))).toEqual({ km: 58200, date: null });
    expect(computeNext(draft({ repeat: true, repeatMonths: '6', lastKm: '48200', lastDate: '14/11/2026' }))).toEqual({ km: null, date: '2027-05-14' });
  });
  it('sans « dernière fois » : rien n’est calculé ; sans « se répète » : jamais', () => {
    expect(computeNext(periodic({}))).toEqual({ km: null, date: null });
    expect(computeNext(draft({ lastKm: '48200', repeatKm: '10000' }))).toEqual({ km: null, date: null });
  });
  it('fin de mois : 31 août + 6 mois = 28 février', () => {
    expect(computeNext(draft({ repeat: true, repeatMonths: '6', lastDate: '31/08/2026' })).date).toBe('2027-02-28');
  });
  it('la saisie manuelle est prioritaire sur le calcul', () => {
    const effective = effectiveDue(periodic({ lastKm: '48200', km: '60000' }));
    expect(effective).toMatchObject({ km: 60000, kmComputed: false });
    expect(effectiveDue(periodic({ lastKm: '48200' }))).toMatchObject({ km: 58200, kmComputed: true });
  });
  it('une échéance calculée suffit à valider (pas besoin de la saisir)', () => {
    expect(validateDue(periodic({ lastKm: '48200' }), 'vidange')).toEqual({});
    expect(validateDue(periodic({}), 'vidange')).toEqual({ date: 'need_one' });
  });
  it('enregistré : la valeur calculée part avec l’échéance', () => {
    const plan = planDueSave({ type: 'vidange' }, vehicle, periodic({ lastKm: '48200', lastDate: '14/11/2026' }));
    expect(plan.createItem).toMatchObject({ echeanceKm: 58200, echeanceDate: '2027-11-14', repeatKm: 10000, repeatMonths: 12 });
  });
  it('« dernière fois » invalide : refusée', () => {
    expect(validateDue(periodic({ lastKm: '-3', km: '70000' }))).toEqual({ lastKm: 'invalid_number' });
    expect(validateDue(periodic({ lastDate: '32/13/2026', km: '70000' }))).toEqual({ lastDate: 'invalid_date' });
  });
});

describe('alerte « déjà dépassée » (jamais bloquante)', () => {
  const NOW = new Date(2026, 10, 14, 12);
  it('kilométrage déjà atteint : de combien', () => {
    expect(dueAlreadyPassed({ date: null, km: 40000 }, 48200, NOW)).toEqual({ km: 8200, days: null });
    expect(dueAlreadyPassed({ date: null, km: 48200 }, 48200, NOW)).toEqual({ km: 0, days: null });
  });
  it('date passée : depuis combien de jours ; aujourd’hui n’est pas passé', () => {
    expect(dueAlreadyPassed({ date: '2026-11-10', km: null }, 48200, NOW)).toEqual({ km: null, days: 4 });
    expect(dueAlreadyPassed({ date: '2026-11-14', km: null }, 48200, NOW)).toBeNull();
  });
  it('rien de dépassé : pas d’alerte ; véhicule sans kilométrage connu : jamais d’alerte km', () => {
    expect(dueAlreadyPassed({ date: '2027-01-01', km: 70000 }, 48200, NOW)).toBeNull();
    expect(dueAlreadyPassed({ date: null, km: 100 }, 0, NOW)).toBeNull();
  });
});

describe('nom d’un entretien « Autre »', () => {
  it('obligatoire pour « Autre » seulement', () => {
    expect(validateDue(draft({ km: '70000' }), 'autre')).toEqual({ titre: 'required' });
    expect(validateDue(draft({ km: '70000', titre: 'Courroie de distribution' }), 'autre')).toEqual({});
    expect(validateDue(draft({ km: '70000' }), 'vidange')).toEqual({});
  });
  it('enregistré pour « Autre », ignoré pour les autres types', () => {
    expect(planDueSave({ type: 'autre' }, vehicle, draft({ km: '70000', titre: ' Courroie de distribution ' })).createItem).toMatchObject({ titre: 'Courroie de distribution' });
    expect(planDueSave({ type: 'vidange' }, vehicle, draft({ km: '70000', titre: 'x' })).createItem).toMatchObject({ titre: null });
  });
});
