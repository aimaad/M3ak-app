import type { CustomerDocument } from './types';

/** Document client complet pour les tests (seuls les champs utiles au test sont à préciser). */
export function makeDocument(overrides: Partial<CustomerDocument> = {}): CustomerDocument {
  return {
    id: 'doc-1',
    type: 'permis',
    customLabel: null,
    reference: null,
    issuingAuthority: null,
    categories: [],
    dateDelivrance: null,
    expiresAt: null,
    path: 'path.jpg',
    notes: null,
    uploadedAt: '2026-01-01T00:00:00Z',
    uploadedBy: null,
    uploadedByName: null,
    ...overrides,
  };
}
