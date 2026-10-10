import { customerDocumentAlerts } from '../document-alerts';
import type { Customer } from '../types';

function buildCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'c1',
    agencyId: 'a1',
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
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('customerDocumentAlerts', () => {
  const today = new Date('2026-06-15T00:00:00Z');

  it('ignore les documents sans date d\'expiration ou encore loin de l\'échéance', () => {
    const customer = buildCustomer({
      documents: [
        { type: 'cin', path: 'p', uploadedAt: 't', uploadedBy: null, reference: null, dateDelivrance: null, expiresAt: null },
        { type: 'permis', path: 'p', uploadedAt: 't', uploadedBy: null, reference: null, dateDelivrance: null, expiresAt: '2027-01-01T00:00:00Z' },
      ],
    });
    expect(customerDocumentAlerts([customer], today)).toEqual([]);
  });

  it('signale un document expiré ou proche de l\'expiration', () => {
    const customer = buildCustomer({
      documents: [
        { type: 'cin', path: 'p', uploadedAt: 't', uploadedBy: null, reference: null, dateDelivrance: null, expiresAt: '2026-06-01T00:00:00Z' },
        { type: 'permis', path: 'p', uploadedAt: 't', uploadedBy: null, reference: null, dateDelivrance: null, expiresAt: '2026-06-20T00:00:00Z' },
      ],
    });
    const alerts = customerDocumentAlerts([customer], today);
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toMatchObject({ type: 'cin', urgency: 'expire' });
    expect(alerts[1]).toMatchObject({ type: 'permis', urgency: 'bientot' });
  });

  it('ignore les clients archivés', () => {
    const customer = buildCustomer({
      archivedAt: '2026-01-01T00:00:00Z',
      documents: [
        { type: 'cin', path: 'p', uploadedAt: 't', uploadedBy: null, reference: null, dateDelivrance: null, expiresAt: '2026-06-01T00:00:00Z' },
      ],
    });
    expect(customerDocumentAlerts([customer], today)).toEqual([]);
  });
});
