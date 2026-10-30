import { Platform } from 'react-native';

/** Vrai dans un navigateur : on peut y imprimer un document HTML directement (boîte d'impression du PC). */
export const canPrintInBrowser = Platform.OS === 'web' && typeof document !== 'undefined';

/**
 * Ouvre la boîte d'impression du navigateur pour un document HTML complet (contrat, rapport…). Le document est chargé
 * dans un cadre invisible : rien ne quitte l'ordinateur, aucun fichier n'est créé. Depuis cette boîte, l'utilisateur
 * choisit l'imprimante ou « Enregistrer au format PDF ».
 */
export function printHtmlInBrowser(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!canPrintInBrowser) {
      reject(new Error('print_unavailable'));
      return;
    }
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    const cleanup = () => window.setTimeout(() => frame.remove(), 60_000);

    frame.onload = () => {
      try {
        const win = frame.contentWindow;
        if (!win) throw new Error('print_unavailable');
        win.focus();
        win.print();
        cleanup();
        resolve();
      } catch (error) {
        frame.remove();
        reject(error);
      }
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}
