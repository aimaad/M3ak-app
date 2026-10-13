import {
  countActive,
  countArchived,
  countExpiringSoonDocuments,
  DEFAULT_CUSTOMER_FILTERS,
  filterCustomers,
} from '../filters';
import type { Customer } from '../types';
import { makeDocument } from '../testing';

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

describe('filterCustomers', () => {
  const customers: Customer[] = [
    makeCustomer({ id: '1', nomComplet: 'Youssef', typeClient: 'particulier' }),
    makeCustomer({ id: '2', nomComplet: 'ACME SARL', typeClient: 'entreprise' }),
    makeCustomer({ id: '3', nomComplet: 'Archivé', archivedAt: '2026-02-01T00:00:00.000Z' }),
  ];

  it('masque les clients archivés par défaut', () => {
    expect(filterCustomers(customers, DEFAULT_CUSTOMER_FILTERS).map((c) => c.id)).toEqual(['1', '2']);
  });

  it('affiche uniquement les archivés quand includeArchived est vrai', () => {
    expect(
      filterCustomers(customers, { ...DEFAULT_CUSTOMER_FILTERS, includeArchived: true }).map((c) => c.id)
    ).toEqual(['3']);
  });

  it('filtre par type de client', () => {
    expect(
      filterCustomers(customers, { ...DEFAULT_CUSTOMER_FILTERS, typeClient: 'entreprise' }).map((c) => c.id)
    ).toEqual(['2']);
  });

  it('combine recherche et filtres', () => {
    expect(
      filterCustomers(customers, { ...DEFAULT_CUSTOMER_FILTERS, query: 'youssef' }).map((c) => c.id)
    ).toEqual(['1']);
  });
});

describe('countActive / countArchived', () => {
  const customers: Customer[] = [
    makeCustomer({ id: '1' }),
    makeCustomer({ id: '2' }),
    makeCustomer({ id: '3', archivedAt: '2026-02-01T00:00:00.000Z' }),
  ];

  it('compte correctement actifs et archivés', () => {
    expect(countActive(customers)).toBe(2);
    expect(countArchived(customers)).toBe(1);
  });
});

describe('countExpiringSoonDocuments', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  it('compte les documents expirant dans la fenêtre donnée, hors archivés', () => {
    const customers: Customer[] = [
      makeCustomer({
        id: '1',
        documents: [
          makeDocument({ type: 'cin', path: 'a', uploadedAt: now.toISOString(), reference: null, expiresAt: '2026-01-10T00:00:00.000Z' }),
        ],
      }),
      makeCustomer({
        id: '2',
        archivedAt: '2025-12-01T00:00:00.000Z',
        documents: [
          makeDocument({ type: 'permis', path: 'b', uploadedAt: now.toISOString(), reference: null, expiresAt: '2026-01-05T00:00:00.000Z' }),
        ],
      }),
    ];
    expect(countExpiringSoonDocuments(customers, 30, now)).toBe(1);
  });
});
