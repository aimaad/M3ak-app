export type Branch = {
  id: string;
  agencyId: string;
  nom: string;
  ville: string | null;
  adresse: string | null;
  createdAt: string;
};

export type BranchInput = {
  nom: string;
  ville: string | null;
  adresse: string | null;
};
