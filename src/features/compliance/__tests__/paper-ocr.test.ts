import type { RenewalDraft } from '../logic';
import { assessPaper, applyPaperFields, hasAnyPaperField, normalizePaperFields, plateMismatch } from '../paper-ocr';
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));


const empty: RenewalDraft = { validFrom: '', validUntil: '', reference: '', provider: '', amount: '', notes: '' };

describe('lecture du papier d’assurance / visite', () => {
  const raw = {
    dateDebut: { value: '2026-11-16', confidence: 'high' },
    dateFin: { value: '2027-11-15', confidence: 'high' },
    numero: { value: 'POL-77', confidence: 'medium' },
    assureur: { value: 'Wafa Assurance', confidence: 'high' },
    montant: { value: 1850.5, confidence: 'high' },
    immatriculation: { value: '8921-ب-14', confidence: 'high' },
  };

  it('normalise : dates, numéro, assureur, montant', () => {
    expect(normalizePaperFields(raw)).toMatchObject({ validFrom: '2026-11-16', validUntil: '2027-11-15', reference: 'POL-77', provider: 'Wafa Assurance', amount: 1850.5 });
  });
  it('visite : le centre devient le prestataire, le résultat est lu', () => {
    const fields = normalizePaperFields({ dateFin: { value: '2027-05-15', confidence: 'high' }, centre: { value: 'Centre Auto Contrôle', confidence: 'high' }, resultat: { value: 'defavorable', confidence: 'high' } });
    expect(fields.provider).toBe('Centre Auto Contrôle');
    expect(fields.favorable).toBe(false);
  });
  it('un champ peu sûr (« low ») ou invalide est ignoré : jamais de valeur inventée', () => {
    const fields = normalizePaperFields({ dateFin: { value: '2027-11-15', confidence: 'low' }, dateDebut: { value: '15/11/2027', confidence: 'high' }, numero: { value: '  ', confidence: 'high' }, montant: { value: -5, confidence: 'high' } });
    expect(fields).toMatchObject({ validFrom: null, validUntil: null, reference: null, amount: null });
    expect(hasAnyPaperField(fields)).toBe(false);
  });
  it('données absurdes : aucune erreur', () => {
    expect(hasAnyPaperField(normalizePaperFields(null))).toBe(false);
    expect(hasAnyPaperField(normalizePaperFields('texte'))).toBe(false);
  });

  it('remplit les champs vides, jamais ce que l’employé a déjà saisi', () => {
    const filled = applyPaperFields({ ...empty, validUntil: '31/12/2027', reference: 'MA-REF' }, normalizePaperFields(raw), true);
    expect(filled.validUntil).toBe('31/12/2027');
    expect(filled.reference).toBe('MA-REF');
    expect(filled.validFrom).toBe('16/11/2026');
    expect(filled.provider).toBe('Wafa Assurance');
    expect(filled.amount).toBe('1850.5');
  });
  it('employé : le montant n’est pas repris', () => {
    expect(applyPaperFields(empty, normalizePaperFields(raw), false).amount).toBe('');
  });

  it('papier d’un autre véhicule : plaque différente détectée, même plaque tolérée', () => {
    expect(plateMismatch('8921-ب-14', '8921 | ب | 14')).toBe(false);
    expect(plateMismatch('1234 | A | 5', '8921 | ب | 14')).toBe(true);
    expect(plateMismatch(null, '8921 | ب | 14')).toBe(false);
  });
});

describe('gestion du risque : le papier lu peut-il être proposé ?', () => {
  const base = { validFrom: '2026-11-16', validUntil: '2027-11-15', reference: 'POL-77', provider: 'Wafa', amount: 1850, plate: '8921-ب-14', favorable: null as boolean | null };
  const ctx = { kind: 'assurance' as const, currentUntil: '2026-11-15', vehiclePlate: '8921 | ب | 14', today: '2026-11-10' };

  it('papier cohérent : proposé, avec ses détails', () => {
    const result = assessPaper(base, ctx);
    expect(result.usable).toBe(true);
    expect(result.period).toEqual({ validFrom: '2026-11-16', validUntil: '2027-11-15' });
    expect(result.details).toMatchObject({ reference: 'POL-77', provider: 'Wafa', amount: 1850 });
    expect(result.cautions).toEqual([]);
  });
  it('papier d’un autre véhicule : jamais proposé', () => {
    const result = assessPaper({ ...base, plate: '1234 | A | 5' }, ctx);
    expect(result.usable).toBe(false);
    expect(result.blockers).toContain('other_vehicle');
    expect(result.period).toBeNull();
    expect(result.details).toBeNull();
  });
  it('visite défavorable : jamais proposée comme renouvellement', () => {
    expect(assessPaper({ ...base, favorable: false }, { ...ctx, kind: 'visite_technique' }).blockers).toContain('unfavorable');
    expect(assessPaper({ ...base, favorable: false }, ctx).blockers).not.toContain('unfavorable'); // ne concerne que la visite
  });
  it('aucune fin lisible : on garde les dates de BIBIP', () => {
    expect(assessPaper({ ...base, validUntil: null, validFrom: null }, ctx).blockers).toContain('no_dates');
  });
  it('papier déjà périmé : refusé', () => {
    expect(assessPaper({ ...base, validFrom: '2025-01-01', validUntil: '2025-12-31' }, ctx).blockers).toContain('already_expired');
  });
  it('papier pas plus récent que la période actuelle (l’ancien papier) : refusé', () => {
    expect(assessPaper({ ...base, validUntil: '2026-11-15' }, ctx).blockers).toContain('not_newer');
    expect(assessPaper({ ...base, validUntil: '2026-06-30', validFrom: '2025-07-01' }, ctx).blockers.length).toBeGreaterThan(0);
  });
  it('première période (aucune période actuelle) : pas de comparaison', () => {
    expect(assessPaper(base, { ...ctx, currentUntil: null }).usable).toBe(true);
  });
  it('durée inhabituelle : proposée mais avec avertissement', () => {
    const result = assessPaper({ ...base, validUntil: '2030-11-15' }, ctx);
    expect(result.usable).toBe(true);
    expect(result.cautions).toContain('odd_duration');
    expect(assessPaper({ ...base, validUntil: '2026-11-20' }, ctx).cautions).toContain('odd_duration');
  });
});
