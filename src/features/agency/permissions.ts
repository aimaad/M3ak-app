import type { AgencyRole } from './types';

/**
 * Qui peut supprimer qui : le owner peut retirer un manager ou un employee ;
 * un manager ne peut retirer qu'un employee (jamais un autre manager, jamais
 * le owner). Personne ne peut se retirer soi-même depuis cet écran, et le
 * owner ne peut jamais être retiré ici (protection définitive côté serveur
 * via le déclencheur prevent_last_owner_removal).
 */
export function canRemoveMember(actorRole: AgencyRole, targetRole: AgencyRole, isSelf: boolean): boolean {
  if (isSelf || targetRole === 'owner') return false;
  if (actorRole === 'owner') return true;
  if (actorRole === 'manager') return targetRole === 'employee';
  return false;
}
