/* eslint-disable import/first -- le « jest.mock » doit précéder les imports */
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

import { normalizeVehicleFields } from '../../ocr';
import { badCharPositions, buildReview, confirmField, initialReviewState, pendingFields, readCount, suggestCorrection, validateReviewValue } from '../review';

const NOW = new Date(2030, 5, 10);
const field = (value: unknown, confidence: 'high' | 'medium' | 'low' = 'high') => ({ value, confidence });
const merged = (patch: Record<string, unknown>) => normalizeVehicleFields({ immatriculation: field('68013-ب-72'), marque: field('Dacia'), modele: field('Sandero'), ...patch });
const review = (patch: Record<string, unknown>) => buildReview(merged(patch), NOW);
const get = (fields: ReturnType<typeof review>, key: string) => fields.find((f) => f.key === key)!;

describe('règles « à vérifier »', () => {
  it('VIN : 17 caractères sans I, O, Q ; sinon à confirmer avec la raison', () => {
    expect(get(review({ vin: field('UU1HSDAGC56789012') }), 'vin').issue).toBeNull();
    expect(get(review({ vin: field('UU1HSDAGC5678901') }), 'vin').issue).toBe('length'); // 16
    expect(get(review({ vin: field('UU1HSDAGC567890123') }), 'vin').issue).toBe('length'); // 18
    expect(get(review({ vin: field('UU1HSDAGC5678901O') }), 'vin').issue).toBe('unreadable_char');
  });

  it('VIN douteux : le caractère invalide est repéré et la correction évidente est proposée', () => {
    const vin = get(review({ vin: field('UU1HSDAGC5678901O') }), 'vin');
    expect(vin.badChars).toEqual([16]);
    expect(vin.raw).toBe('UU1HSDAGC5678901O'); // « SUR LA CARTE » : la valeur lue
    expect(vin.value).toBe('UU1HSDAGC56789010'); // O → 0, pré-rempli
    expect(badCharPositions('vin', 'AIB-OQ')).toEqual([1, 3, 4, 5]); // I, - , O, Q
    expect(suggestCorrection('vin', ' uu1-hsdagc5678901o ')).toBe('UU1HSDAGC56789010');
  });

  it('date : impossible ou future → à confirmer ; lettre qui ressemble à un chiffre corrigée', () => {
    expect(get(review({ dateMiseEnCirculation: field('2022-03-12') }), 'dateMiseEnCirculation').issue).toBeNull();
    expect(get(review({ dateMiseEnCirculation: field('2031-01-01') }), 'dateMiseEnCirculation').issue).toBe('invalid_date'); // après aujourd'hui
    expect(get(review({ dateMiseEnCirculation: field('1949-01-01') }), 'dateMiseEnCirculation').issue).toBe('invalid_date');
    expect(validateReviewValue('dateMiseEnCirculation', '31/02/2022', NOW)).toBe('invalid_date');
    expect(validateReviewValue('dateMiseEnCirculation', '12/03/2O22', NOW)).toBe('invalid_date');
    expect(suggestCorrection('dateMiseEnCirculation', '12/03/2O22')).toBe('12/03/2022');
    expect(badCharPositions('dateMiseEnCirculation', '12/03/2O22')).toEqual([7]);
    expect(validateReviewValue('dateMiseEnCirculation', suggestCorrection('dateMiseEnCirculation', '12/03/2O22'), NOW)).toBeNull();
  });

  it('plaque hors format → à confirmer ; marocaine et WW valables', () => {
    expect(get(review({ immatriculation: field('AB 12') }), 'immatriculation').issue).toBe('format');
    expect(get(review({ immatriculation: field('ww 482190') }), 'immatriculation').issue).toBeNull();
    expect(get(review({}), 'immatriculation').issue).toBeNull();
    expect(get(review({}), 'immatriculation').value).toBe('68013 | ب | 72');
  });

  it('champ essentiel vide → à confirmer ; VIN, genre ou propriétaire vides ne bloquent pas', () => {
    const fields = review({ marque: field(null), vin: field(null), genre: field(null) });
    expect(get(fields, 'marque').issue).toBe('missing');
    expect(get(fields, 'vin').issue).toBeNull();
    expect(get(fields, 'genre').issue).toBeNull();
  });

  it('confiance faible avec une valeur valable → « Lecture peu sûre » ; confiance moyenne → petit point jaune, rien d’obligatoire', () => {
    const fields = review({ modele: field('Sandero', 'low'), marque: field('Dacia', 'medium') });
    expect(get(fields, 'modele').issue).toBe('low');
    expect(get(fields, 'marque')).toMatchObject({ issue: null, uncertain: true });
    expect(get(fields, 'immatriculation')).toMatchObject({ issue: null, uncertain: false });
  });

  it('puissance fiscale hors limites → à confirmer', () => {
    expect(validateReviewValue('puissanceFiscale', '6', NOW)).toBeNull();
    expect(validateReviewValue('puissanceFiscale', '0', NOW)).toBe('format');
    expect(validateReviewValue('puissanceFiscale', '61', NOW)).toBe('format');
  });
});

describe('confirmation champ par champ', () => {
  const fields = review({ vin: field('UU1HSDAGC5678901O'), modele: field('Sandero', 'low') });

  it('à l’ouverture : seuls les champs douteux attendent, dans l’ordre de l’écran', () => {
    const state = initialReviewState(fields);
    expect(pendingFields(fields, state)).toEqual(['modele', 'vin']);
    expect(state.marque.confirmed).toBe(true);
  });

  it('confirmer avec la valeur corrigée libère le champ ; une valeur encore invalide est refusée', () => {
    let state = initialReviewState(fields);
    const refused = confirmField(state, 'vin', 'UU1HSDAGC567890', NOW);
    expect(refused.issue).toBe('length');
    expect(pendingFields(fields, refused.state)).toContain('vin');
    state = confirmField(state, 'vin', 'UU1HSDAGC5678901O', NOW).state; // la correction évidente est appliquée (O → 0)
    expect(state.vin).toEqual({ value: 'UU1HSDAGC56789010', confirmed: true });
    state = confirmField(state, 'modele', 'Sandero', NOW).state;
    expect(pendingFields(fields, state)).toEqual([]);
  });

  it('champs lus : ceux qui ont une valeur', () => {
    expect(readCount(review({ vin: field('UU1HSDAGC56789012'), carburant: field('diesel') }))).toBe(5); // plaque, marque, modèle, VIN, carburant
    expect(readCount(review({}))).toBe(3);
  });
});
