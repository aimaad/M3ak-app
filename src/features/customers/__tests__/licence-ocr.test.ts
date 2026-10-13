// Ces tests utilisent un OCR SIMULÉ (texte fabriqué) : ils vérifient la transformation et les
// garde-fous côté app, PAS la qualité d'une vraie lecture sur un appareil.
import { isFormValid, toCustomerInput, validateCustomerForm, type CustomerFormValues } from '../validation';
import {
  EMPTY_CREATION_DRAFT,
  hasAnyOcrValue,
  licenceFieldsToDraft,
  normalizeLicenceFields,
  scanLicence,
  type LicenceOcrFields,
} from '../licence-ocr';

const mockExtract = jest.fn();
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({ functions: { invoke: jest.fn() } }) }));
jest.mock('expo-file-system', () => ({ File: class { base64() { return Promise.resolve('BASE64'); } } }));
jest.mock('expo-text-extractor', () => ({
  isSupported: true,
  extractTextFromImage: (...args: unknown[]) => mockExtract(...args),
}));

const BASE_FORM: CustomerFormValues = {
  nomComplet: '',
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
      nomComplet: 'Sara ALAOUI',
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
    expect(draft.uncertainFields).toEqual(expect.arrayContaining(['nomComplet', 'prenom']));
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
    const values = { ...BASE_FORM, ...draft.values, prenom: 'Sarah', nomComplet: 'Sarah ALAOUI' } as CustomerFormValues;
    const input = toCustomerInput(values);
    expect(input.prenom).toBe('Sarah');
    expect(input.nomComplet).toBe('Sarah ALAOUI');
  });
});

describe("création manuelle quand l'OCR échoue", () => {
  it('un brouillon vide laisse le formulaire entièrement manuel et valide une fois rempli', () => {
    expect(EMPTY_CREATION_DRAFT.fromOcr).toBe(false);
    expect(EMPTY_CREATION_DRAFT.pendingDocuments).toHaveLength(0);

    const values: CustomerFormValues = { ...BASE_FORM, nomComplet: 'Client Manuel' };
    expect(isFormValid(validateCustomerForm(values))).toBe(true);
  });

  it('une lecture sans aucune valeur exploitable est détectée (on propose la saisie manuelle)', () => {
    expect(hasAnyOcrValue(normalizeLicenceFields({ nom: { value: 'X', confidence: 'low' } }))).toBe(false);
  });
});

describe('scanLicence (OCR local simulé)', () => {
  beforeEach(() => mockExtract.mockReset());

  it("lit le permis à partir du texte reconnu sur l'appareil", async () => {
    mockExtract.mockResolvedValue(['ROYAUME DU MAROC', '1. ALAOUI', '2. Sara', '4a. 01.05.2019', '4b. 01.05.2029', '5. 12/345678', '9. B']);
    const result = await scanLicence('file:///permis.jpg');
    expect(mockExtract).toHaveBeenCalledWith('file:///permis.jpg');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.nom.value).toBe('ALAOUI');
      expect(result.fields.dateExpiration.value).toBe('2029-05-01');
    }
  });

  it('renvoie une erreur claire (saisie manuelle) si la lecture locale échoue', async () => {
    mockExtract.mockRejectedValue(new Error('native failure with /private/path/permis.jpg'));
    expect(await scanLicence('file:///permis.jpg')).toEqual({ ok: false, error: 'ocr_failed' });
  });
});
