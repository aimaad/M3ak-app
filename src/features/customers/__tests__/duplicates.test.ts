import { findPotentialDuplicates } from '../duplicates';
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
