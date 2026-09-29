import { Directory, File, Paths } from 'expo-file-system';

function getInspectionsDirectory(): Directory {
  const dir = new Directory(Paths.document, 'inspections');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

/**
 * Copie la photo prise par la caméra (fichier temporaire) vers le dossier "documents"
 * de l'app, qui survit aux redémarrages — nécessaire pour l'envoi différé hors ligne.
 */
export function persistCapturedPhoto(tempUri: string, filename: string): string {
  const directory = getInspectionsDirectory();
  const destination = new File(directory, filename);
  if (destination.exists) {
    destination.delete();
  }
  new File(tempUri).copySync(destination);
  return destination.uri;
}

export function deleteLocalPhoto(uri: string): void {
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}
