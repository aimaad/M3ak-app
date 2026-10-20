/** Saisie d'un pourcentage : uniquement des chiffres, jamais plus de 100 (« 250 » devient « 100 »). */
export function clampPercentInput(text: string): string {
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (digits === '') return '';
  return Number(digits) > 100 ? '100' : digits;
}
