import type { ReactNode } from 'react';

import { fixPlateDirection } from '@/lib/plate';

/**
 * Les nombres au format français (« 2 200 ») utilisent l'espace fine insécable U+202F, absente de Plus Jakarta Sans :
 * elle s'affichait comme « 2200 ». On la remplace par l'espace insécable classique U+00A0, présente dans toutes les polices.
 */
export function normalizeText(node: ReactNode): ReactNode {
  if (typeof node === 'string') return fixPlateDirection(node).replace(/ /g, ' ');
  if (Array.isArray(node)) return node.map((child) => normalizeText(child));
  return node;
}
