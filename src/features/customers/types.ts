export type DocumentType = 'cin' | 'permis' | 'passeport' | 'autre';

export const DOCUMENT_TYPES: DocumentType[] = ['cin', 'permis', 'passeport', 'autre'];

export type CustomerType = 'particulier' | 'entreprise';
export const CUSTOMER_TYPES: CustomerType[] = ['particulier', 'entreprise'];

export type PreferredLanguage = 'fr' | 'ar' | 'darija';
export const PREFERRED_LANGUAGES: PreferredLanguage[] = ['fr', 'ar', 'darija'];

export type CustomerDocument = {
  type: DocumentType;
  path: string;
  uploadedAt: string;
  uploadedBy: string | null;
  reference: string | null;
  dateDelivrance: string | null;
  expiresAt: string | null;
};

export type PendingDocument = {
  type: DocumentType;
  localUri: string;
  reference: string | null;
  dateDelivrance: string | null;
  expiresAt: string | null;
};

export type Customer = {
  id: string;
  agencyId: string;
  nomComplet: string;
  prenom: string | null;
  nom: string | null;
  cinOuPasseport: string | null;
  numeroPermis: string | null;
  telephone: string | null;
  telephoneSecondaire: string | null;
  email: string | null;
  adresse: string | null;
  ville: string | null;
  pays: string;
  dateNaissance: string | null;
  languePreferee: PreferredLanguage | null;
  typeClient: CustomerType;
  raisonSociale: string | null;
  ice: string | null;
  notes: string | null;
  documents: CustomerDocument[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerInput = {
  nomComplet: string;
  prenom: string | null;
  nom: string | null;
  cinOuPasseport: string | null;
  numeroPermis: string | null;
  telephone: string | null;
  telephoneSecondaire: string | null;
  email: string | null;
  adresse: string | null;
  ville: string | null;
  pays: string;
  dateNaissance: string | null;
  languePreferee: PreferredLanguage | null;
  typeClient: CustomerType;
  raisonSociale: string | null;
  ice: string | null;
  notes: string | null;
};

export type Driver = {
  id: string;
  agencyId: string;
  customerId: string;
  nomComplet: string;
  cinOuPasseport: string | null;
  numeroPermis: string | null;
  telephone: string | null;
  documents: CustomerDocument[];
  createdAt: string;
};

export type DriverInput = {
  nomComplet: string;
  cinOuPasseport: string | null;
  numeroPermis: string | null;
  telephone: string | null;
};
