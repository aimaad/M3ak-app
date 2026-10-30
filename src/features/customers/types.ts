export type DocumentType =
  | 'permis'
  | 'cin'
  | 'passeport'
  | 'justificatif_domicile'
  | 'autre_justificatif'
  | 'autre';

/** Ordre d'affichage : le permis d'abord (c'est le document le plus utile à la location). */
export const DOCUMENT_TYPES: DocumentType[] = [
  'permis',
  'cin',
  'passeport',
  'justificatif_domicile',
  'autre_justificatif',
  'autre',
];

export type CustomerType = 'particulier' | 'entreprise';
export const CUSTOMER_TYPES: CustomerType[] = ['particulier', 'entreprise'];

export type PreferredLanguage = 'fr' | 'ar' | 'darija';
export const PREFERRED_LANGUAGES: PreferredLanguage[] = ['fr', 'ar', 'darija'];

/** Un document d'un client ou d'un conducteur (table customer_documents). */
export type CustomerDocument = {
  id: string;
  type: DocumentType;
  /** Libellé libre, pour « Autre document ». */
  customLabel: string | null;
  reference: string | null;
  issuingAuthority: string | null;
  /** Catégories de permis (B, C, D…), vide pour les autres documents. */
  categories: string[];
  dateDelivrance: string | null;
  expiresAt: string | null;
  /** null : aucun fichier (numéro saisi à la main) ou fichier supprimé. */
  path: string | null;
  /** Fichier du verso (permis marocain recto-verso), null si absent. */
  pathVerso?: string | null;
  notes: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
};

/** Saisie d'un document (ajout ou correction), avant envoi du fichier. */
export type DocumentInput = {
  type: DocumentType;
  customLabel: string | null;
  reference: string | null;
  issuingAuthority: string | null;
  categories: string[];
  dateDelivrance: string | null;
  expiresAt: string | null;
  notes: string | null;
};

export type PendingDocument = DocumentInput & {
  localUri: string | null;
  /** Photo du verso (permis, carte d'identité) : enregistrée avec le même document. */
  localUriVerso?: string | null;
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
  /** Ancien champ libre : conservé en base mais remplacé par les notes internes (customer_notes). */
  notes: string | null;
  consentementDonnees: boolean;
  consentementDate: string | null;
  /** Documents actifs (non supprimés), plusieurs par type possibles. */
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
};

export type Driver = {
  id: string;
  agencyId: string;
  /** Client auquel le conducteur est rattaché. */
  customerId: string;
  /** Renseigné quand le conducteur EST une fiche client existante (identité et documents du client). */
  linkedCustomerId: string | null;
  nomComplet: string;
  /** Prénom et nom séparés (contrat) ; null pour un conducteur créé avant leur ajout. */
  prenom?: string | null;
  nom?: string | null;
  cinOuPasseport: string | null;
  numeroPermis: string | null;
  telephone: string | null;
  createdAt: string;
};

export type DriverInput = {
  nomComplet: string;
  prenom?: string | null;
  nom?: string | null;
  cinOuPasseport: string | null;
  numeroPermis: string | null;
  telephone: string | null;
};
