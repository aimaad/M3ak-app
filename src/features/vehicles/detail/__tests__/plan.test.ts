import { draftFromPlanned, emptyPlanDraft, minutesOf, planToInput, validatePlan } from '../plan';

const NOW = new Date(2026, 10, 14, 10, 0);

describe('planifier une échéance', () => {
  it('date et heure obligatoires ; durée et garage facultatifs', () => {
    expect(validatePlan(emptyPlanDraft(), NOW)).toEqual({ date: 'required', time: 'required' });
    expect(validatePlan({ date: '2026-11-20', time: '09:30', hours: '', garage: '' }, NOW)).toEqual({});
  });
  it('un rendez-vous passé est refusé (marge d’une heure)', () => {
    expect(validatePlan({ date: '2026-11-14', time: '08:00', hours: '', garage: '' }, NOW)).toEqual({ time: 'past' });
    expect(validatePlan({ date: '2026-11-14', time: '09:30', hours: '', garage: '' }, NOW)).toEqual({});
  });
  it('durée en heures : 1,5 h = 90 min ; vide = inconnue ; absurde refusée', () => {
    expect(minutesOf('1,5')).toBe(90);
    expect(minutesOf('2')).toBe(120);
    expect(minutesOf('')).toBeNull();
    expect(validatePlan({ date: '2026-11-20', time: '09:30', hours: '0', garage: '' }, NOW)).toEqual({ hours: 'invalid_number' });
    expect(validatePlan({ date: '2026-11-20', time: '09:30', hours: 'abc', garage: '' }, NOW)).toEqual({ hours: 'invalid_number' });
    expect(validatePlan({ date: '2026-11-20', time: '09:30', hours: '500', garage: '' }, NOW)).toEqual({ hours: 'invalid_number' });
  });
  it('garage trop long refusé', () => {
    expect(validatePlan({ date: '2026-11-20', time: '09:30', hours: '', garage: 'x'.repeat(121) }, NOW)).toEqual({ garage: 'too_long' });
  });
  it('envoyé : date et heure locales en ISO, durée en minutes, garage nettoyé', () => {
    const input = planToInput({ date: '2026-11-20', time: '09:30', hours: '1,5', garage: ' Garage Atlas ' });
    expect(new Date(input.at).getTime()).toBe(new Date(2026, 10, 20, 9, 30).getTime());
    expect(input.minutes).toBe(90);
    expect(input.garage).toBe('Garage Atlas');
    expect(planToInput({ date: '2026-11-20', time: '09:30', hours: '', garage: '  ' })).toMatchObject({ minutes: null, garage: null });
  });
  it('modifier un rendez-vous : le brouillon reprend date, heure, durée et garage', () => {
    const iso = new Date(2026, 10, 20, 9, 30).toISOString();
    expect(draftFromPlanned(iso, 90, 'Garage Atlas')).toEqual({ date: '2026-11-20', time: '09:30', hours: '1,5', garage: 'Garage Atlas' });
    expect(draftFromPlanned(iso, null, null)).toEqual({ date: '2026-11-20', time: '09:30', hours: '', garage: '' });
  });
});
