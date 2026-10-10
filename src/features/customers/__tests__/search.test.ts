import { searchCustomers } from '../search';
import type { Customer } from '../types';

function makeCustomer(overrides: Partial<Customer>): Customer {
  return {
    id: '1',
    agencyId: 'agency-1',
    nomComplet: 'Youssef El Amrani',
    prenom: null,
    nom: null,
    cinOuPasseport: 'BE482913',
    numeroPermis: 'A123456',
    telephone: '+212661234567',
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

describe('searchCustomers', () => {
  const customers: Customer[] = [
    makeCustomer({ id: '1', nomComplet: 'Youssef El Amrani', telephone: '+212661234567', cinOuPasseport: 'BE482913', email: 'youssef@example.com' }),
    makeCustomer({ id: '2', nomComplet: 'Salma Bennani', telephone: '+212662345678', cinOuPasseport: 'BK190273', raisonSociale: 'Bennani Transport SARL' }),
  ];

  it('renvoie tout si la recherche est vide', () => {
    expect(searchCustomers(customers, '')).toHaveLength(2);
  });

  it('filtre par nom, insensible à la casse', () => {
    expect(searchCustomers(customers, 'salma').map((c) => c.id)).toEqual(['2']);
  });

  it('filtre par téléphone', () => {
    expect(searchCustomers(customers, '661234567').map((c) => c.id)).toEqual(['1']);
  });

  it('filtre par CIN', () => {
    expect(searchCustomers(customers, 'bk190273').map((c) => c.id)).toEqual(['2']);
  });

  it('filtre par e-mail', () => {
    expect(searchCustomers(customers, 'youssef@example.com').map((c) => c.id)).toEqual(['1']);
  });

  it('filtre par raison sociale', () => {
    expect(searchCustomers(customers, 'bennani transport').map((c) => c.id)).toEqual(['2']);
  });

  it('filtre par référence de document', () => {
    const withDoc: Customer[] = [
      makeCustomer({
        id: '3',
        nomComplet: 'Client Avec Référence',
        documents: [
          { type: 'cin', path: 'a', uploadedAt: '2026-01-01', uploadedBy: null, reference: 'REF-9988', dateDelivrance: null, expiresAt: null },
        ],
      }),
    ];
    expect(searchCustomers(withDoc, 'ref-9988').map((c) => c.id)).toEqual(['3']);
  });
});
