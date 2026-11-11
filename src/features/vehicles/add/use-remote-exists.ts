import { useEffect, useState } from 'react';

import { checkVehicleExists, type RemoteExists } from './remote-exists';

/**
 * Contrôle serveur du doublon (autre filiale comprise), avec un léger délai pendant la frappe. Le résultat n'est rendu que s'il correspond à
 * la plaque et au VIN actuels : une réponse en retard ne s'affiche jamais pour une autre plaque. `null` tant qu'on ne sait pas.
 */
export function useRemoteExists(agencyId: string | undefined, plate: string, vin: string, delayMs = 500): RemoteExists | null {
  const key = `${agencyId ?? ''}|${plate}|${vin}`;
  const [answer, setAnswer] = useState<{ key: string; result: RemoteExists | null } | null>(null);

  useEffect(() => {
    if (!agencyId || (!plate.trim() && !vin.trim())) return undefined;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      const result = await checkVehicleExists(agencyId, { plate, vin });
      if (!cancelled) setAnswer({ key, result });
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [agencyId, plate, vin, key, delayMs]);

  return answer?.key === key ? answer.result : null;
}
