import type { ComplianceRecord } from '../types';
import { addMonths, allStatuses, complianceStatus, currentRecord, daysUntil, historyOf, rentalWarnings, renewalDraft, renewalInput, suggestRenewal, validateRenewal } from '../logic';

const NOW = new Date(2026, 10, 15, 12); // 15 nov. 2026
const rec = (kind: ComplianceRecord['kind'], validUntil: string, extra: Partial<ComplianceRecord> = {}): ComplianceRecord => ({ id: `${kind}-${validUntil}`, agencyId: 'a', vehicleId: 'v', kind, validFrom: null, validUntil, reference: null, provider: null, amount: null, documentPath: null, notes: null, createdBy: null, createdAt: '2026-01-01T00:00:00Z', ...extra });
const vehicle: { dateMiseEnCirculation?: string | null } = { dateMiseEnCirculation: null };
const settings = { visitIntervalMonths: 6 };

describe('dates', () => {
  it('jours restants : aujourd’hui = 0, demain = 1, hier = -1', () => {
    expect(daysUntil('2026-11-15', NOW)).toBe(0);
    expect(daysUntil('2026-11-16', NOW)).toBe(1);
    expect(daysUntil('2026-11-14', NOW)).toBe(-1);
  });
  it('mois ajoutés sans déborder', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-15', 6)).toBe('2027-05-15');
    expect(addMonths('2026-11-15', 12)).toBe('2027-11-15');
  });
});

describe('période en cours et historique', () => {
  const records = [rec('assurance', '2026-06-30'), rec('assurance', '2027-06-30'), rec('visite_technique', '2026-11-20')];
  it('la période en cours est celle qui finit le plus tard', () => {
    expect(currentRecord(records, 'assurance')?.validUntil).toBe('2027-06-30');
    expect(currentRecord(records, 'vignette')).toBeNull();
  });
  it('historique : du plus récent au plus ancien, par type', () => {
    expect(historyOf(records, 'assurance').map((r) => r.validUntil)).toEqual(['2027-06-30', '2026-06-30']);
  });
});

describe('état du jour', () => {
  const state = (validUntil: string) => complianceStatus('assurance', [rec('assurance', validUntil)], vehicle, NOW).state;
  it('à jour (> 30 jours), bientôt (≤ 30), urgent (≤ 7), expiré (hier)', () => {
    expect(state('2027-01-15')).toBe('valid');
    expect(state('2026-12-15')).toBe('soon'); // 30 jours
    expect(state('2026-11-22')).toBe('urgent'); // 7 jours
    expect(state('2026-11-14')).toBe('expired');
  });
  it('qui finit AUJOURD’HUI : encore valable (urgent), expirée demain', () => {
    const today = complianceStatus('assurance', [rec('assurance', '2026-11-15')], vehicle, NOW);
    expect(today).toMatchObject({ state: 'urgent', days: 0 });
    expect(complianceStatus('assurance', [rec('assurance', '2026-11-15')], vehicle, new Date(2026, 10, 16, 9)).state).toBe('expired');
  });
  it('rien d’enregistré : « none » (jamais « expiré »)', () => {
    expect(complianceStatus('visite_technique', [], vehicle, NOW)).toMatchObject({ state: 'none', record: null, days: null });
  });
  it('renouvelée : l’ancienne période expirée ne compte plus', () => {
    const records = [rec('assurance', '2026-06-30'), rec('assurance', '2027-06-29')];
    expect(complianceStatus('assurance', records, vehicle, NOW).state).toBe('valid');
  });
  it('les trois obligations sont toujours renvoyées', () => {
    expect(allStatuses([], vehicle, NOW).map((s) => s.kind)).toEqual(['assurance', 'visite_technique', 'vignette']);
  });
});

describe('vignette', () => {
  const status = (records: ComplianceRecord[], now = NOW, v = vehicle) => complianceStatus('vignette', records, v, now);
  it('année en cours couverte, loin de la prochaine date limite : à jour, prochaine échéance le 31 janvier suivant', () => {
    expect(status([rec('vignette', '2026-12-31')])).toMatchObject({ state: 'valid', due: '2027-01-31', isDeadline: true });
  });
  it('en décembre : encore à jour (la date limite suivante est le 31 janvier, à plus de 30 jours)', () => {
    expect(status([rec('vignette', '2026-12-31')], new Date(2026, 11, 20))).toMatchObject({ state: 'valid', days: 42 });
  });
  it('1er janvier, année pas encore payée : date limite le 31 janvier (soon), puis expirée le 1er février', () => {
    const old = [rec('vignette', '2026-12-31')];
    expect(status(old, new Date(2027, 0, 5))).toMatchObject({ state: 'soon', due: '2027-01-31' });
    expect(status(old, new Date(2027, 0, 28)).state).toBe('urgent');
    expect(status(old, new Date(2027, 1, 1)).state).toBe('expired');
  });
  it('aucune vignette enregistrée : « non renseignée » (pas d’alarme sur l’existant)', () => {
    expect(status([])).toMatchObject({ state: 'none', record: null });
  });
  it('véhicule mis en circulation dans l’année : date limite 60 jours après', () => {
    expect(status([], NOW, { dateMiseEnCirculation: '2026-10-01' }).due).toBe('2026-11-30');
  });
});

describe('renouvellement : période proposée', () => {
  it('assurance : 12 mois à partir du lendemain de la fin en cours', () => {
    expect(suggestRenewal('assurance', rec('assurance', '2026-12-26'), settings, NOW)).toEqual({ validFrom: '2026-12-27', validUntil: '2027-12-26' });
  });
  it('assurance expirée ou absente : à partir d’aujourd’hui', () => {
    expect(suggestRenewal('assurance', rec('assurance', '2026-10-01'), settings, NOW)).toEqual({ validFrom: '2026-11-15', validUntil: '2027-11-14' });
    expect(suggestRenewal('assurance', null, settings, NOW)).toEqual({ validFrom: '2026-11-15', validUntil: '2027-11-14' });
  });
  it('visite technique : périodicité de l’agence (6 mois par défaut, 12 si réglée)', () => {
    expect(suggestRenewal('visite_technique', null, settings, NOW)).toEqual({ validFrom: '2026-11-15', validUntil: '2027-05-15' });
    expect(suggestRenewal('visite_technique', null, { visitIntervalMonths: 12 }, NOW).validUntil).toBe('2027-11-15');
  });
  it('vignette : année civile ; l’année suivante si l’année en cours est déjà couverte', () => {
    expect(suggestRenewal('vignette', null, settings, NOW)).toEqual({ validFrom: '2026-01-01', validUntil: '2026-12-31' });
    expect(suggestRenewal('vignette', rec('vignette', '2026-12-31'), settings, NOW)).toEqual({ validFrom: '2027-01-01', validUntil: '2027-12-31' });
  });
});

describe('renouvellement : validation', () => {
  const draft = (extra = {}) => ({ ...renewalDraft({ validFrom: '2026-12-27', validUntil: '2027-12-26' }), ...extra });
  const current = rec('assurance', '2026-12-26');
  it('période valide : aucune erreur', () => {
    expect(validateRenewal(draft(), current)).toEqual({});
  });
  it('fin obligatoire et réelle', () => {
    expect(validateRenewal(draft({ validUntil: '' }), null)).toEqual({ validUntil: 'required' });
    expect(validateRenewal(draft({ validUntil: '32/13/2027' }), null)).toEqual({ validUntil: 'invalid_date' });
  });
  it('début après la fin refusé', () => {
    expect(validateRenewal(draft({ validFrom: '01/01/2028' }), null)).toEqual({ validUntil: 'ends_before_start' });
  });
  it('doit finir APRÈS la période en cours (sinon ce n’est pas un renouvellement)', () => {
    expect(validateRenewal(draft({ validFrom: '', validUntil: '26/12/2026' }), current)).toEqual({ validUntil: 'ends_before_current' });
    expect(validateRenewal(draft({ validFrom: '', validUntil: '27/12/2026' }), current)).toEqual({});
  });
  it('montant : positif ou vide ; virgule acceptée', () => {
    expect(validateRenewal(draft({ amount: '-5' }), null)).toEqual({ amount: 'invalid_amount' });
    expect(validateRenewal(draft({ amount: 'abc' }), null)).toEqual({ amount: 'invalid_amount' });
    expect(validateRenewal(draft({ amount: '4200,50' }), null)).toEqual({});
  });
  it('référence et assureur : longueurs maximales', () => {
    expect(validateRenewal(draft({ reference: 'x'.repeat(81), provider: 'y'.repeat(121) }), null)).toEqual({ reference: 'too_long', provider: 'too_long' });
  });
  it('envoi : dates ISO, montant en nombre, champs vides → null', () => {
    expect(renewalInput('v1', 'assurance', draft({ reference: ' POL-1 ', amount: '4200,5' }), 'p.jpg')).toEqual({
      vehicleId: 'v1', kind: 'assurance', validFrom: '2026-12-27', validUntil: '2027-12-26', reference: 'POL-1', provider: null, amount: 4200.5, documentPath: 'p.jpg', notes: null,
    });
  });
});

describe('avertissements avant une location (jamais bloquants)', () => {
  const ok = [rec('assurance', '2027-12-31'), rec('visite_technique', '2027-12-31'), rec('vignette', '2026-12-31')];
  const start = new Date(2026, 10, 20);
  const end = new Date(2026, 10, 27);
  it('tout est à jour : aucun avertissement', () => {
    expect(rentalWarnings(ok, vehicle, start, end, NOW)).toEqual([]);
  });
  it('assurance ou visite sans aucune période : « à vérifier »', () => {
    expect(rentalWarnings([rec('vignette', '2026-12-31')], vehicle, start, end, NOW).map((w) => [w.kind, w.code])).toEqual([['assurance', 'missing'], ['visite_technique', 'missing']]);
  });
  it('assurance expirée au départ', () => {
    expect(rentalWarnings([rec('assurance', '2026-11-10'), ...ok.slice(1)], vehicle, start, end, NOW)).toEqual([{ kind: 'assurance', code: 'expired', due: '2026-11-10' }]);
  });
  it('visite qui expire PENDANT la location', () => {
    expect(rentalWarnings([ok[0], rec('visite_technique', '2026-11-23'), ok[2]], vehicle, start, end, NOW)).toEqual([{ kind: 'visite_technique', code: 'expires_before_end', due: '2026-11-23' }]);
  });
  it('qui finit le dernier jour de la location : pas d’avertissement', () => {
    expect(rentalWarnings([ok[0], rec('visite_technique', '2026-11-27'), ok[2]], vehicle, start, end, NOW)).toEqual([]);
  });
  it('départ dans le passé : on compare à aujourd’hui', () => {
    expect(rentalWarnings([rec('assurance', '2026-11-15'), ...ok.slice(1)], vehicle, new Date(2026, 10, 1), new Date(2026, 10, 15), NOW)).toEqual([]);
  });
  it('vignette expirée : avertit ; vignette non renseignée : silence', () => {
    const late = [ok[0], ok[1], rec('vignette', '2025-12-31')];
    expect(rentalWarnings(late, vehicle, start, end, NOW)).toEqual([{ kind: 'vignette', code: 'expired', due: '2026-01-31' }]);
    expect(rentalWarnings([ok[0], ok[1]], vehicle, start, end, NOW)).toEqual([]);
  });
});
