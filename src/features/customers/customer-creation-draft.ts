import { EMPTY_CREATION_DRAFT, type CustomerCreationDraft } from './licence-ocr';

/**
 * Brouillon en mémoire entre l'écran de scan et le formulaire de création de client (même
 * principe que le brouillon de création de véhicule) : le parcours est linéaire, dans le même
 * processus JS, jamais persisté.
 */
let draft: CustomerCreationDraft | null = null;

export function setCustomerCreationDraft(value: CustomerCreationDraft): void {
  draft = value;
}

export function takeCustomerCreationDraft(): CustomerCreationDraft {
  const value = draft ?? EMPTY_CREATION_DRAFT;
  draft = null;
  return value;
}
