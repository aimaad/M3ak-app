export type DocumentType = 'cin' | 'permis';

export const DOCUMENT_TYPES: DocumentType[] = ['cin', 'permis'];

export type CustomerDocument = {
  type: DocumentType;
  path: string;
  uploadedAt: string;
};

export type Customer = {
  id: string;
  agencyId: string;
  nomComplet: string;
  cinOuPasseport: string | null;
  numeroPermis: string | null;
  telephone: string | null;
  email: string | null;
  documents: CustomerDocument[];
  createdAt: string;
};

export type CustomerInput = {
  nomComplet: string;
  cinOuPasseport: string | null;
  numeroPermis: string | null;
  telephone: string | null;
  email: string | null;
};

export type PendingDocument = {
  type: DocumentType;
  localUri: string;
};
