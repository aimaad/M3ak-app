import { findDuplicateMatches, findPotentialDuplicates, normalizeLicenceNumber } from '../duplicates';
import type { Customer } from '../types';

function makeCustomer(overrides: Partial<Customer>): Customer {
  return {
    id: overrides.id ?? '1',
    agencyId: 'agency-1',
    nomComplet: 'Client Test',
    prenom: null,
    nom: null,
    cinOuPasseport: null,
    numeroPermis: null,
    telephone: null,
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
    notes: null,
    consentementDonnees: false,
    consentementDate: null,
    documents: [],
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('findPotentialDuplicates', () => {
  const customers: Customer[] = [
    makeCustomer({ id: '1', telephone: '+212600000001', cinOuPasseport: 'AB123456' }),
    makeCustomer({ id: '2', telephone: '0600000002', cinOuPasseport: 'CD789012' }),
  ];

  it('détecte un doublon par téléphone, même avec un format différent', () => {
    const result = findPotentialDuplicates(customers, { telephone: '06 00 00 00 01' });
    expect(result.map((c) => c.id)).toEqual(['1']);
  });

  it('détecte un doublon par CIN, insensible à la casse et aux espaces', () => {
    const result = findPotentialDuplicates(customers, { cinOuPasseport: ' cd789012 ' });
    expect(result.map((c) => c.id)).toEqual(['2']);
  });

  it("ne renvoie rien s'il n'y a aucune correspondance", () => {
    expect(findPotentialDuplicates(customers, { telephone: '0699999999' })).toHaveLength(0);
  });

  it("ne renvoie rien si ni téléphone ni CIN ne sont fournis", () => {
    expect(findPotentialDuplicates(customers, {})).toHaveLength(0);
  });

  it('exclut le client en cours de modification', () => {
    const result = findPotentialDuplicates(customers, { telephone: '0600000001' }, '1');
    expect(result).toHaveLength(0);
  });
});

describe('findDuplicateMatches (avec la raison)', () => {
  const doc = (reference: string | null) => ({
    id: 'd1', type: 'permis' as const, customLabel: null, reference, issuingAuthority: null, categories: ['B'],
    dateDelivrance: null, expiresAt: null, path: null, notes: null, uploadedAt: '2026-01-01T00:00:00Z', uploadedBy: null, uploadedByName: null,
  });
  const customers: Customer[] = [
    makeCustomer({ id: 'a', nomComplet: 'Fouad Bouchnef', dateNaissance: '1990-03-12', numeroPermis: '12/345678', telephone: '0661000001' }),
    makeCustomer({ id: 'b', nomComplet: 'Sara Alaoui', documents: [doc('98 123456')], telephone: '0661000002' }),
  ];

  it('reconnaît le même numéro de permis, quelle que soit la présentation', () => {
    expect(normalizeLicenceNumber('12 / 345-678')).toBe('12345678');
    const matches = findDuplicateMatches(customers, { numeroPermis: '12345678' });
    expect(matches.map((m) => [m.customer.id, m.reasons])).toEqual([['a', ['licence_number']]]);
  });

  it("reconnaît le numéro d'un document de permis déjà enregistré", () => {
    const matches = findDuplicateMatches(customers, { numeroPermis: '98/123456' });
    expect(matches[0]).toMatchObject({ customer: { id: 'b' }, reasons: ['licence_number'] });
  });

  it('reconnaît même nom et même date de naissance (accents et casse ignorés)', () => {
    const matches = findDuplicateMatches(customers, { nomComplet: 'FOUAD  BOUCHNEF', dateNaissance: '1990-03-12' });
    expect(matches[0]).toMatchObject({ customer: { id: 'a' }, reasons: ['name_and_birth'] });
    expect(findDuplicateMatches(customers, { nomComplet: 'Fouad Bouchnef', dateNaissance: '1991-01-01' })).toEqual([]);
  });

  it('cumule les raisons et ne signale rien sans correspondance', () => {
    const matches = findDuplicateMatches(customers, { telephone: '+212661000001', numeroPermis: '12/345678' });
    expect(matches[0].reasons).toEqual(['phone', 'licence_number']);
    expect(findDuplicateMatches(customers, { numeroPermis: '99/999999', telephone: '0600000000' })).toEqual([]);
    expect(findDuplicateMatches(customers, { numeroPermis: '12' })).toEqual([]); // trop court pour comparer
  });

  it('ignore la fiche en cours de modification', () => {
    expect(findDuplicateMatches(customers, { numeroPermis: '12/345678' }, 'a')).toEqual([]);
  });
});
