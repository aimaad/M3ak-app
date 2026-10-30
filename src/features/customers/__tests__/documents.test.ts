import {
  bestDocumentOfType,
  documentExpiryStatus,
  documentLabel,
  documentsOfType,
  documentToFormValues,
  EMPTY_DOCUMENT_FORM,
  expiresBefore,
  isDocumentFormValid,
  parseCategories,
  parseDateInput,
  toDocumentInput,
  validateDocumentForm,
} from '../documents';
import type { CustomerDocument } from '../types';

function makeDoc(overrides: Partial<CustomerDocument> = {}): CustomerDocument {
  return {
    id: 'd1',
    type: 'permis',
    customLabel: null,
    reference: null,
    issuingAuthority: null,
    categories: [],
    dateDelivrance: null,
    expiresAt: null,
    path: 'a/b.jpg',
    notes: null,
    uploadedAt: '2026-01-01T00:00:00.000Z',
    uploadedBy: null,
    uploadedByName: null,
    ...overrides,
  };
}

describe('plusieurs documents de types différents', () => {
  const docs = [
    makeDoc({ id: 'p', type: 'permis' }),
    makeDoc({ id: 'c', type: 'cin' }),
    makeDoc({ id: 'pp', type: 'passeport' }),
    makeDoc({ id: 'j', type: 'justificatif_domicile' }),
    makeDoc({ id: 'a', type: 'autre_justificatif' }),
    makeDoc({ id: 'x', type: 'autre', customLabel: 'Carte pro' }),
    makeDoc({ id: 'p2', type: 'permis' }),
  ];

  it('conserve tous les documents, y compris plusieurs du même type', () => {
    expect(docs).toHaveLength(7);
    expect(documentsOfType(docs, 'permis').map((d) => d.id)).toEqual(['p', 'p2']);
    expect(documentsOfType(docs, 'cin')).toHaveLength(1);
  });

  it("affiche le libellé libre d'un « autre document » et la traduction des autres", () => {
    const translate = (key: string) => `T(${key})`;
    expect(documentLabel(docs[5], translate)).toBe('Carte pro');
    expect(documentLabel(docs[0], translate)).toBe('T(customer.documentTypes.permis)');
    expect(documentLabel(makeDoc({ type: 'autre', customLabel: '  ' }), translate)).toBe('T(customer.documentTypes.autre)');
  });
});

describe('bestDocumentOfType', () => {
  it("choisit celui qui expire le plus tard, avant un document sans date", () => {
    const docs = [
      makeDoc({ id: 'sans', expiresAt: null, uploadedAt: '2026-05-01T00:00:00Z' }),
      makeDoc({ id: 'tot', expiresAt: '2027-01-01' }),
      makeDoc({ id: 'tard', expiresAt: '2031-01-01' }),
    ];
    expect(bestDocumentOfType(docs, 'permis')?.id).toBe('tard');
  });

  it('à défaut de dates, prend le plus récemment ajouté', () => {
    const docs = [
      makeDoc({ id: 'ancien', uploadedAt: '2025-01-01T00:00:00Z' }),
      makeDoc({ id: 'recent', uploadedAt: '2026-01-01T00:00:00Z' }),
    ];
    expect(bestDocumentOfType(docs, 'permis')?.id).toBe('recent');
  });

  it('renvoie null si aucun document de ce type', () => {
    expect(bestDocumentOfType([makeDoc({ type: 'cin' })], 'permis')).toBeNull();
  });
});

describe("dates d'expiration", () => {
  const today = new Date('2026-06-15T00:00:00Z');

  it('distingue expiré, bientôt expiré, valide et sans date', () => {
    expect(documentExpiryStatus({ expiresAt: '2026-06-01' }, today)).toBe('expired');
    expect(documentExpiryStatus({ expiresAt: '2026-07-01' }, today)).toBe('expiring_soon');
    expect(documentExpiryStatus({ expiresAt: '2030-01-01' }, today)).toBe('ok');
    expect(documentExpiryStatus({ expiresAt: null }, today)).toBe('no_date');
  });

  it("détecte un document qui expire avant la fin de la location", () => {
    expect(expiresBefore({ expiresAt: '2026-06-20' }, '2026-06-25T18:00:00.000Z')).toBe(true);
    expect(expiresBefore({ expiresAt: '2026-06-30' }, '2026-06-25T18:00:00.000Z')).toBe(false);
    expect(expiresBefore({ expiresAt: null }, '2026-06-25T18:00:00.000Z')).toBe(false);
  });
});

describe('parseDateInput', () => {
  it('accepte AAAA-MM-JJ et JJ/MM/AAAA', () => {
    expect(parseDateInput('2029-05-01')).toBe('2029-05-01');
    expect(parseDateInput('01/05/2029')).toBe('2029-05-01');
    expect(parseDateInput('1-5-2029')).toBe('2029-05-01');
  });

  it('refuse les dates impossibles ou mal formées', () => {
    expect(parseDateInput('31/02/2029')).toBeNull();
    expect(parseDateInput('demain')).toBeNull();
    expect(parseDateInput('')).toBeNull();
  });
});

describe('validateDocumentForm', () => {
  it("n'exige aucun champ pour un document standard (rien d'obligatoire)", () => {
    expect(isDocumentFormValid(validateDocumentForm(EMPTY_DOCUMENT_FORM))).toBe(true);
  });

  it('refuse une date invalide et une expiration avant la délivrance', () => {
    expect(validateDocumentForm({ ...EMPTY_DOCUMENT_FORM, expiresAt: 'xx' }).expiresAt).toBe('invalid_date');
    expect(
      validateDocumentForm({ ...EMPTY_DOCUMENT_FORM, dateDelivrance: '01/01/2025', expiresAt: '01/01/2024' }).expiresAt
    ).toBe('dates_order');
  });

  it("exige un libellé pour « autre document »", () => {
    expect(validateDocumentForm({ ...EMPTY_DOCUMENT_FORM, type: 'autre' }).customLabel).toBe('required');
    expect(validateDocumentForm({ ...EMPTY_DOCUMENT_FORM, type: 'autre', customLabel: 'Carte pro' }).customLabel).toBeUndefined();
  });
});

describe('toDocumentInput / documentToFormValues', () => {
  it('normalise les saisies (dates ISO, catégories de permis en majuscules sans doublon)', () => {
    const input = toDocumentInput({
      ...EMPTY_DOCUMENT_FORM,
      type: 'permis',
      reference: ' 12/345678 ',
      dateDelivrance: '01/05/2019',
      expiresAt: '01/05/2029',
      categories: 'b, c1; B',
      notes: '  ',
    });
    expect(input).toMatchObject({
      reference: '12/345678',
      dateDelivrance: '2019-05-01',
      expiresAt: '2029-05-01',
      categories: ['B', 'C1'],
      notes: null,
      customLabel: null,
    });
  });

  it("ignore les catégories pour un autre type que le permis", () => {
    expect(toDocumentInput({ ...EMPTY_DOCUMENT_FORM, type: 'cin', categories: 'B' }).categories).toEqual([]);
  });

  it("revient au formulaire sans perte (correction d'un document existant)", () => {
    const doc = makeDoc({ reference: 'P1', categories: ['B', 'C'], expiresAt: '2030-01-01', notes: 'ok' });
    const values = documentToFormValues(doc);
    expect(values.categories).toBe('B, C');
    expect(toDocumentInput(values)).toMatchObject({ reference: 'P1', categories: ['B', 'C'], expiresAt: '2030-01-01', notes: 'ok' });
  });
});

describe('parseCategories', () => {
  it('découpe sur espaces, virgules, points-virgules et barres', () => {
    expect(parseCategories('b, c ; d/e')).toEqual(['B', 'C', 'D', 'E']);
    expect(parseCategories('')).toEqual([]);
  });
});
