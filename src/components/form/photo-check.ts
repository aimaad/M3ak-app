import * as ImageManipulator from 'expo-image-manipulator';

import { photoProblem } from './logic';

export type PhotoCheck = { ok: true; width: number; height: number; bytes: number } | { ok: false; reason: 'too_small' | 'unreadable'; width?: number; height?: number; bytes?: number };

/**
 * Contrôle d'une photo AVANT l'envoi, sur le téléphone : côté le plus long < 1000 px ou fichier < 30 Ko → « Photo trop petite ». Une photo
 * illisible (fichier introuvable ou corrompu) est refusée aussi. Ne détecte ni le flou ni le sombre (voir docs/FORMULAIRES.md : la lecture
 * côté serveur pourra les signaler).
 */
export async function checkPhoto(uri: string): Promise<PhotoCheck> {
  try {
    const info = await ImageManipulator.manipulateAsync(uri, [], {});
    const bytes = (await (await fetch(uri)).arrayBuffer()).byteLength;
    const problem = photoProblem({ width: info.width, height: info.height, bytes });
    return problem ? { ok: false, reason: problem, width: info.width, height: info.height, bytes } : { ok: true, width: info.width, height: info.height, bytes };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}
