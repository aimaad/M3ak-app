export type BranchFormValues = {
  nom: string;
  ville: string;
  adresse: string;
};

export type BranchFormErrorCode = 'required';
export type BranchFormErrors = Partial<Record<'nom', BranchFormErrorCode>>;

export function validateBranchForm(values: BranchFormValues): BranchFormErrors {
  const errors: BranchFormErrors = {};
  if (!values.nom.trim()) {
    errors.nom = 'required';
  }
  return errors;
}

export function isBranchFormValid(errors: BranchFormErrors): boolean {
  return Object.keys(errors).length === 0;
}
