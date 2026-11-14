import type { Vehicle } from '../../types';
import { quickDoneDraft, quickDoneInput, validateQuickDone } from '../quick-done';

const NOW = new Date(2026, 10, 14, 12);
const vehicle = { kilometrage: 48_200 } as Pick<Vehicle, 'kilometrage'>;

describe('« Fait » en un geste', () => {
  it('tout est déjà rempli : kilométrage de la fiche, date du jour', () => {
    expect(quickDoneDraft(vehicle, NOW)).toEqual({ km: '48200', date: '2026-11-14', garage: '', cout: '' });
  });

  it('un véhicule neuf (0 km) : kilométrage vide, jamais « 0 »', () => {
    expect(quickDoneDraft({ kilometrage: 0 }, NOW).km).toBe('');
  });

  it('le brouillon prérempli est valide tel quel (un seul geste)', () => {
    expect(validateQuickDone(quickDoneDraft(vehicle, NOW), vehicle, NOW)).toEqual({});
  });

  it('kilométrage inférieur à la fiche : refusé ; supérieur : accepté', () => {
    expect(validateQuickDone({ ...quickDoneDraft(vehicle, NOW), km: '40000' }, vehicle, NOW)).toEqual({ km: 'km_lower' });
    expect(validateQuickDone({ ...quickDoneDraft(vehicle, NOW), km: '48900' }, vehicle, NOW)).toEqual({});
    expect(validateQuickDone({ ...quickDoneDraft(vehicle, NOW), km: '99999999' }, vehicle, NOW)).toEqual({ km: 'invalid_number' });
  });

  it('date dans le futur et coût négatif : refusés', () => {
    expect(validateQuickDone({ ...quickDoneDraft(vehicle, NOW), date: '2026-12-01' }, vehicle, NOW)).toEqual({ date: 'future' });
    expect(validateQuickDone({ ...quickDoneDraft(vehicle, NOW), cout: '-5' }, vehicle, NOW)).toEqual({ cout: 'invalid_cost' });
  });

  it('ce qui part au serveur : le coût seulement pour ceux qui voient les montants', () => {
    const draft = { km: '48900', date: '2026-11-14', garage: ' Garage Atlas ', cout: '450,5' };
    expect(quickDoneInput(draft, true)).toEqual({ km: 48900, date: '2026-11-14', garage: 'Garage Atlas', cout: 450.5 });
    expect(quickDoneInput(draft, false)).toEqual({ km: 48900, date: '2026-11-14', garage: 'Garage Atlas', cout: null });
    expect(quickDoneInput({ km: '', date: '', garage: '', cout: '' }, true)).toEqual({ km: null, date: null, garage: null, cout: null });
  });
});
