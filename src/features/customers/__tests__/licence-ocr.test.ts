// Ces tests utilisent des réponses d'analyse SIMULÉES : ils vérifient la transformation et les garde-fous
// côté app, PAS la qualité d'une vraie lecture (voir orchestration.test.ts pour l'appel au serveur).
import { isFormValid, toCustomerInput, validateCustomerForm, type CustomerFormValues } from '../validation';
import {
  checkLicence,
  EMPTY_CREATION_DRAFT,
  emptyLicenceFields,
  hasAnyOcrValue,
  licenceFaceStatus,
  licenceFieldsToDraft,
  mergeLicenceFields,
  normalizeLicenceFields,
  type LicenceOcrFields,
} from '../licence-ocr';


jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({ functions: { invoke: jest.fn() } }) }));
jest.mock('expo-file-system', () => ({ File: class { base64() { return Promise.resolve('BASE64'); } } }));

const BASE_FORM: CustomerFormValues = {
  prenom: '',
  nom: '',
  cinOuPasseport: '',
  numeroPermis: '',
  telephone: '0661234567',
  telephoneSecondaire: '',
  email: '',
  adresse: '',
  ville: '',
  pays: 'Maroc',
  dateNaissance: '',
  languePreferee: null,
  typeClient: 'particulier',
  raisonSociale: '',
  ice: '',
};

const SIMULATED_OCR_RESPONSE = {
  nom: { value: ' ALAOUI ', confidence: 'high' },
  prenom: { value: 'Sara', confidence: 'medium' },
  numeroPermis: { value: '12/345678', confidence: 'high' },
  dateDelivrance: { value: '01/05/2019', confidence: 'high' },
  dateExpiration: { value: '2029-05-01', confidence: 'medium' },
  categories: { value: ['b', 'c1', 'B'], confidence: 'high' },
  dateNaissance: { value: '1990-02-30', confidence: 'high' }, // date impossible : doit être rejetée
  autorite: { value: null, confidence: 'low' },
};

describe('normalizeLicenceFields (OCR simulé)', () => {
  const fields = normalizeLicenceFields(SIMULATED_OCR_RESPONSE);

  it('nettoie les textes et les catégories', () => {
    expect(fields.nom).toEqual({ value: 'ALAOUI', confidence: 'high' });
    expect(fields.categories).toEqual({ value: ['B', 'C1'], confidence: 'high' });
  });

  it('convertit les dates en ISO et rejette une date impossible au lieu de la deviner', () => {
    expect(fields.dateDelivrance.value).toBe('2019-05-01');
    expect(fields.dateNaissance).toEqual({ value: null, confidence: 'low' });
  });

  it("ne produit jamais de valeur quand le champ est absent ou n'a pas le bon type", () => {
    const empty = normalizeLicenceFields({ nom: 12, prenom: null, numeroPermis: { value: 42, confidence: 'high' } });
    expect(empty.nom.value).toBeNull();
    expect(empty.prenom.value).toBeNull();
    expect(empty.numeroPermis.value).toBeNull();
    expect(normalizeLicenceFields(undefined).dateExpiration.value).toBeNull();
    expect(hasAnyOcrValue(normalizeLicenceFields(undefined))).toBe(false);
  });

  it('remplace une confiance inconnue par « low »', () => {
    expect(normalizeLicenceFields({ nom: { value: 'X', confidence: 'certain' } }).nom.confidence).toBe('low');
  });
});

describe("création d'un client par OCR (OCR simulé)", () => {
  const fields = normalizeLicenceFields(SIMULATED_OCR_RESPONSE);
  const draft = licenceFieldsToDraft(fields, 'file:///permis.jpg');

  it('préremplit les champs lus, jamais les champs illisibles', () => {
    expect(draft.fromOcr).toBe(true);
    expect(draft.values).toMatchObject({
      prenom: 'Sara',
      nom: 'ALAOUI',
      numeroPermis: '12/345678',
    });
    expect(draft.values.dateNaissance).toBeUndefined();
  });

  it('prépare un document « permis » avec ses dates, catégories et la photo', () => {
    expect(draft.pendingDocuments).toHaveLength(1);
    expect(draft.pendingDocuments[0]).toMatchObject({
      type: 'permis',
      reference: '12/345678',
      dateDelivrance: '2019-05-01',
      expiresAt: '2029-05-01',
      categories: ['B', 'C1'],
      localUri: 'file:///permis.jpg',
    });
  });

  it('signale les champs incertains pour vérification humaine', () => {
    expect(draft.uncertainFields).toEqual(expect.arrayContaining(['prenom']));
    expect(draft.uncertainFields).not.toContain('nom');
    expect(draft.uncertainDocumentFields).toContain('expiresAt');
    expect(draft.uncertainDocumentFields).not.toContain('reference');
  });

  it('ignore les champs « low » même s’ils ont une valeur', () => {
    const lowFields: LicenceOcrFields = {
      ...fields,
      nom: { value: 'FLOU', confidence: 'low' },
      prenom: { value: null, confidence: 'low' },
      numeroPermis: { value: 'X1', confidence: 'low' },
    };
    const lowDraft = licenceFieldsToDraft(lowFields, null);
    expect(lowDraft.values.nom).toBeUndefined();
    expect(lowDraft.values.numeroPermis).toBeUndefined();
  });

  it('crée le client une fois le formulaire prérempli validé (téléphone saisi par l’employé)', () => {
    const values = { ...BASE_FORM, ...draft.values } as CustomerFormValues;
    expect(isFormValid(validateCustomerForm(values))).toBe(true);
    expect(toCustomerInput(values)).toMatchObject({ nomComplet: 'Sara ALAOUI', numeroPermis: '12/345678', telephone: '0661234567' });
  });

  it("l'employé corrige un champ extrait avant validation : la valeur corrigée est celle enregistrée", () => {
    const values = { ...BASE_FORM, ...draft.values, prenom: 'Sarah' } as CustomerFormValues;
    const input = toCustomerInput(values);
    expect(input.prenom).toBe('Sarah');
    expect(input.nomComplet).toBe('Sarah ALAOUI');
  });
});

describe("création manuelle quand l'OCR échoue", () => {
  it('un brouillon vide laisse le formulaire entièrement manuel et valide une fois rempli', () => {
    expect(EMPTY_CREATION_DRAFT.fromOcr).toBe(false);
    expect(EMPTY_CREATION_DRAFT.pendingDocuments).toHaveLength(0);

    const values: CustomerFormValues = { ...BASE_FORM, prenom: 'Client', nom: 'Manuel' };
    expect(isFormValid(validateCustomerForm(values))).toBe(true);
  });

  it('une lecture sans aucune valeur exploitable est détectée (on propose la saisie manuelle)', () => {
    expect(hasAnyOcrValue(normalizeLicenceFields({ nom: { value: 'X', confidence: 'low' } }))).toBe(false);
  });
});

// Valeurs d'un vrai permis marocain (recto + verso). Réponses d'analyse simulées : on vérifie la fusion et les garde-fous.
describe('permis marocain recto + verso (OCR simulé)', () => {
  const f = (value: unknown, confidence = 'high') => ({ value, confidence });
  const recto = normalizeLicenceFields({
    prenom: f('FOUAD'),
    nom: f('BOUCHNEF'),
    cin: f('z 188822'.toUpperCase()),
    numeroPermis: f('20/086579'),
    dateNaissance: f('1975-01-09'),
    dateDelivrance: f('2011-04-06'),
    autorite: f('Taza'),
    categories: f(['B'], 'medium'),
  });
  const verso = normalizeLicenceFields({
    categories: f(['B']),
    dateDelivrance: f('2011-04-06', 'medium'),
    dateExpiration: f('2025-02-07'),
    restrictions: f('01.01'),
  });
  const merged = mergeLicenceFields(recto, verso);

  it('reconnaît chaque face', () => {
    expect(licenceFaceStatus(recto)).toEqual({ recto: true, verso: false });
    expect(licenceFaceStatus(verso)).toEqual({ recto: false, verso: true });
    expect(licenceFaceStatus(emptyLicenceFields())).toEqual({ recto: false, verso: false });
  });

  it('fusionne sans qu’une face vide l’autre et prend la lecture la plus sûre', () => {
    expect(merged.nom.value).toBe('BOUCHNEF');
    expect(merged.dateExpiration.value).toBe('2025-02-07');
    expect(merged.categories).toEqual({ value: ['B'], confidence: 'high' });
    expect(mergeLicenceFields(merged, emptyLicenceFields())).toEqual(merged);
  });

  it('additionne les catégories des deux faces', () => {
    const other = normalizeLicenceFields({ categories: f(['C']) });
    expect(mergeLicenceFields(recto, other).categories.value).toEqual(['B', 'C']);
  });

  it('prépare le client et un seul document permis avec recto, verso et restrictions', () => {
    const draft = licenceFieldsToDraft(merged, 'file:///recto.jpg', { versoUri: 'file:///verso.jpg' });
    expect(draft.values).toMatchObject({ prenom: 'FOUAD', nom: 'BOUCHNEF', cinOuPasseport: 'Z188822', numeroPermis: '20/086579', dateNaissance: '1975-01-09' });
    expect(draft.pendingDocuments).toHaveLength(1);
    expect(draft.pendingDocuments[0]).toMatchObject({
      type: 'permis',
      reference: '20/086579',
      issuingAuthority: 'Taza',
      categories: ['B'],
      dateDelivrance: '2011-04-06',
      expiresAt: '2025-02-07',
      notes: 'Restrictions : 01.01',
      localUri: 'file:///recto.jpg',
      localUriVerso: 'file:///verso.jpg',
    });
  });

  it('avertit : permis expiré, bientôt expiré, sans catégorie B', () => {
    expect(checkLicence(merged, new Date('2026-10-18')).map((c) => c.code)).toEqual(['licence_expired']);
    expect(checkLicence(merged, new Date('2025-01-15')).map((c) => c.code)).toEqual(['licence_expiring']);
    expect(checkLicence(merged, new Date('2024-01-01'))).toEqual([]);
    expect(checkLicence(normalizeLicenceFields({ categories: f(['A']) })).map((c) => c.code)).toContain('no_category_b');
  });
});
