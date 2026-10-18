import {
  checkRegistrationCard,
  emptyVehicleFields,
  faceStatus,
  filledCount,
  mergeVehicleFields,
  normalizePlate,
  normalizeVehicleFields,
  yearFromFields,
} from '../ocr';

jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({ functions: { invoke: jest.fn() } }) }));
jest.mock('expo-file-system', () => ({ File: class {} }));

const field = (value: unknown, confidence = 'high') => ({ value, confidence });

/** Lecture du RECTO de la carte grise marocaine (nouveau format carte bancaire). */
const RECTO = {
  immatriculation: field('68013-ب-72'),
  immatriculationAnterieure: field('WW675804'),
  dateMiseEnCirculation: field('2025-08-27'),
  dateFinValidite: field('2035-10-01'),
  usage: field('Véhicule loué sans chauffeur'),
  proprietaire: field('KEY MJ CAR SARL-AU'),
};

/** Lecture du VERSO. */
const VERSO = {
  marque: field('DACIA'),
  modele: field('SANDERO'),
  type: field('DJFBDSAF56S00M5600'),
  genre: field('CONDUITE INTERIEURE'),
  carburant: field('diesel'),
  vin: field('UU1DJF00674861301'),
  nombreCylindres: field(4),
  puissanceFiscale: field(6),
  nombrePlaces: field(5),
  ptac: field(1620),
  poidsVide: field(1240),
};

describe('carte grise marocaine : recto + verso', () => {
  const recto = normalizeVehicleFields(RECTO);
  const verso = normalizeVehicleFields(VERSO);
  const both = mergeVehicleFields(recto, verso);

  it('met l\'immatriculation au format de l\'app', () => {
    expect(recto.immatriculation.value).toBe('68013 | ب | 72');
    expect(normalizePlate('8921-أ-14')).toBe('8921 | أ | 14');
    expect(normalizePlate('8921 | ب | 14')).toBe('8921 | ب | 14');
    expect(normalizePlate('W 123456')).toBe('W 123456');
  });

  it('reconnaît quelle face a été lue', () => {
    expect(faceStatus(recto)).toEqual({ recto: true, verso: false });
    expect(faceStatus(verso)).toEqual({ recto: false, verso: true });
    expect(faceStatus(both)).toEqual({ recto: true, verso: true });
    expect(faceStatus(emptyVehicleFields())).toEqual({ recto: false, verso: false });
  });

  it('fusionne les deux faces sans rien perdre', () => {
    expect(both.immatriculation.value).toBe('68013 | ب | 72');
    expect(both.marque.value).toBe('DACIA');
    expect(both.modele.value).toBe('SANDERO');
    expect(both.vin.value).toBe('UU1DJF00674861301');
    expect(both.carburant.value).toBe('diesel');
    expect(both.nombrePlaces.value).toBe(5);
    expect(both.puissanceFiscale.value).toBe(6);
    expect(both.dateFinValidite.value).toBe('2035-10-01');
    expect(both.usage.value).toBe('Véhicule loué sans chauffeur');
    // le même résultat quel que soit l'ordre des photos
    expect(mergeVehicleFields(verso, recto).vin.value).toBe(both.vin.value);
    expect(filledCount(both)).toBe(filledCount(recto) + filledCount(verso));
  });

  it('déduit l\'année de la date de première mise en circulation', () => {
    expect(yearFromFields(both)).toBe(2025);
    expect(yearFromFields(emptyVehicleFields())).toBeNull();
  });

  it('en cas de désaccord, garde la lecture la plus sûre ; une face ne vide jamais l\'autre', () => {
    const doubtful = normalizeVehicleFields({ marque: field('DACLA', 'medium') });
    const sure = normalizeVehicleFields({ marque: field('DACIA', 'high') });
    expect(mergeVehicleFields(doubtful, sure).marque.value).toBe('DACIA');
    expect(mergeVehicleFields(sure, doubtful).marque.value).toBe('DACIA');
    expect(mergeVehicleFields(sure, emptyVehicleFields()).marque.value).toBe('DACIA');
  });

  it('ne signale rien d\'anormal sur la carte d\'exemple (usage location, validité 2035, châssis de 17 caractères)', () => {
    expect(checkRegistrationCard(both, new Date(2026, 9, 18))).toEqual([]);
  });

  it('avertit si l\'usage n\'est pas la location, si la carte est expirée ou bientôt expirée, ou si le châssis est suspect', () => {
    const today = new Date(2026, 9, 18);
    const codes = (patch: object) => checkRegistrationCard(mergeVehicleFields(both, normalizeVehicleFields(patch)), today).map((c) => c.code);
    expect(checkRegistrationCard(normalizeVehicleFields({ ...RECTO, usage: field('Voiture particulière') }), today).map((c) => c.code)).toContain('usage_not_rental');
    expect(checkRegistrationCard(normalizeVehicleFields({ ...RECTO, dateFinValidite: field('2026-01-01') }), today).map((c) => c.code)).toContain('card_expired');
    expect(checkRegistrationCard(normalizeVehicleFields({ ...RECTO, dateFinValidite: field('2026-11-20') }), today).map((c) => c.code)).toContain('card_expiring');
    expect(checkRegistrationCard(normalizeVehicleFields({ vin: field('UU1DJF') }), today).map((c) => c.code)).toContain('vin_length');
    expect(codes({})).toEqual([]);
  });

  it('rejette les valeurs impossibles (date invalide, CV hors limites, carburant inconnu)', () => {
    const bad = normalizeVehicleFields({ dateMiseEnCirculation: field('27/08/2025'), puissanceFiscale: field(500), carburant: field('gaz'), nombrePlaces: field(99), ptac: field(5) });
    expect(bad.dateMiseEnCirculation.value).toBeNull();
    expect(bad.puissanceFiscale.value).toBeNull();
    expect(bad.carburant.value).toBeNull();
    expect(bad.nombrePlaces.value).toBeNull();
    expect(bad.ptac.value).toBeNull();
  });

  it('ne fabrique ni finition ni couleur (absentes de la carte)', () => {
    expect(both.finition.value).toBeNull();
    expect(both.couleur.value).toBeNull();
  });
});
