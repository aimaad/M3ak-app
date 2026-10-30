export type PersonName = { prenom: string; nom: string };

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 60;

export type PersonNameError = 'required' | 'invalid_name';

/** Prénom ou nom : 2 à 60 caractères, sans chiffres (accepte l'arabe et les accents). */
export function validatePersonName(raw: string): PersonNameError | null {
  const value = raw.trim();
  if (!value) return 'required';
  if (value.length < MIN_NAME_LENGTH || value.length > MAX_NAME_LENGTH || /\d/.test(value)) {
    return 'invalid_name';
  }
  return null;
}

export function buildFullName({ prenom, nom }: PersonName): string {
  return `${prenom.trim()} ${nom.trim()}`.trim();
}

/** Lit prénom/nom enregistrés à l'inscription (métadonnées du compte). */
export function readNamesFromMetadata(metadata: Record<string, unknown> | null | undefined): PersonName | null {
  const prenom = typeof metadata?.prenom === 'string' ? metadata.prenom.trim() : '';
  const nom = typeof metadata?.nom === 'string' ? metadata.nom.trim() : '';
  return prenom && nom ? { prenom, nom } : null;
}
