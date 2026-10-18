import { entriesAreValid, entriesFromPending, entriesToPending, isEmptyEntry, licenceGaps, reconcilePermisNumber, type PendingEntry } from '../creation';
import { EMPTY_DOCUMENT_FORM, type DocumentFormValues } from '../documents';
import type { CustomerInput, PendingDocument } from '../types';

const BASE_INPUT: CustomerInput = {
  nomComplet: 'Sara Alaoui',
  prenom: null,
  nom: null,
  cinOuPasseport: null,
  numeroPermis: null,
  telephone: '0661234567',
  telephoneSecondaire: null,
  email: null,
  adresse: null,
  ville: null,
  pays: 'Maroc',
  dateNaissance: null,
  languePreferee: null,
  typeClient: 'particulier',
  raisonSociale: null,
  ice: null,
};

function permis(overrides: Partial<PendingDocument> = {}): PendingDocument {
  return {
    type: 'permis',
    customLabel: null,
    reference: null,
    issuingAuthority: null,
    categories: [],
    dateDelivrance: null,
    expiresAt: null,
    notes: null,
    localUri: null,
    ...overrides,
  };
}

describe('reconcilePermisNumber', () => {
  it('reprend le numéro du document sur la fiche quand celle-ci est vide', () => {
    const { input } = reconcilePermisNumber(BASE_INPUT, [permis({ reference: '12/345678' })]);
    expect(input.numeroPermis).toBe('12/345678');
  });

  it('reprend le numéro de la fiche sur le document permis qui n’en a pas', () => {
    const { documents } = reconcilePermisNumber({ ...BASE_INPUT, numeroPermis: 'AB-1' }, [permis()]);
    expect(documents[0].reference).toBe('AB-1');
  });

  it('n’écrase jamais une valeur déjà saisie', () => {
    const { input, documents } = reconcilePermisNumber({ ...BASE_INPUT, numeroPermis: 'FICHE' }, [permis({ reference: 'DOC' })]);
    expect(input.numeroPermis).toBe('FICHE');
    expect(documents[0].reference).toBe('DOC');
  });

  it('ne touche pas aux autres types de documents', () => {
    const { documents } = reconcilePermisNumber({ ...BASE_INPUT, numeroPermis: 'AB-1' }, [{ ...permis(), type: 'cin' }]);
    expect(documents[0].reference).toBeNull();
  });
});

describe('entrées de documents du formulaire de création', () => {
  it('passe du scan au formulaire puis aux documents à enregistrer sans perte', () => {
    const pending = permis({ reference: 'P1', categories: ['B', 'C'], expiresAt: '2030-05-01', localUri: 'file://p.jpg' });
    const entries = entriesFromPending([pending]);
    expect(entries[0].values.categories).toBe('B, C');
    expect(entriesToPending(entries)[0]).toMatchObject({ type: 'permis', reference: 'P1', categories: ['B', 'C'], expiresAt: '2030-05-01', localUri: 'file://p.jpg' });
  });

  it('valide des dates correctes, aucune saisie n’étant obligatoire', () => {
    expect(entriesAreValid([])).toBe(true);
    expect(entriesAreValid([{ key: 'k', values: EMPTY_DOCUMENT_FORM, localUri: null }])).toBe(true);
  });

  it('refuse une date invalide ou une expiration avant la délivrance', () => {
    expect(entriesAreValid([{ key: 'k', values: { ...EMPTY_DOCUMENT_FORM, expiresAt: 'bientôt' }, localUri: null }])).toBe(false);
    expect(
      entriesAreValid([{ key: 'k', values: { ...EMPTY_DOCUMENT_FORM, dateDelivrance: '2025-01-01', expiresAt: '2024-01-01' }, localUri: null }])
    ).toBe(false);
  });
});

describe('permis obligatoire à la création', () => {
  const entry = (over: Partial<Omit<PendingEntry, 'values'>> & { values?: Partial<DocumentFormValues> } = {}): PendingEntry => ({
    key: 'k',
    localUri: null,
    ...over,
    values: { ...EMPTY_DOCUMENT_FORM, type: 'permis', ...over.values },
  });

  it('exige le document permis', () => {
    expect(licenceGaps([], '')).toEqual(['no_licence']);
    expect(licenceGaps([entry({ values: { type: 'cin' } })], '')).toEqual(['no_licence']);
  });

  it('exige la photo, le numéro et la date d’expiration', () => {
    expect(licenceGaps([entry()], '')).toEqual(['no_photo', 'no_number', 'no_expiry']);
    expect(licenceGaps([entry({ localUri: 'file:///p.jpg', values: { reference: '20/086579', expiresAt: '07/02/2025' } })], '')).toEqual([]);
  });

  it('accepte le numéro saisi sur la fiche au lieu du document', () => {
    expect(licenceGaps([entry({ localUri: 'file:///p.jpg', values: { expiresAt: '2030-01-01' } })], '20/086579')).toEqual([]);
  });

  it('repère une entrée vide', () => {
    expect(isEmptyEntry(entry())).toBe(true);
    expect(isEmptyEntry(entry({ localUri: 'file:///p.jpg' }))).toBe(false);
  });
});
