import { createElement, useCallback } from 'react';
import type { CSSProperties } from 'react';

type HtmlFrameProps = {
  html: string;
  style?: CSSProperties;
  /** Appelé quand le lecteur arrive en bas du document (ou quand tout tient à l'écran). */
  onReachEnd?: () => void;
  /** Titre lu par les lecteurs d'écran. */
  title?: string;
};

/**
 * Équivalent web de `WebView` : affiche un document HTML (aperçu du cachet, lecture du contrat) dans un cadre isolé
 * (`srcdoc`, sans scripts du document ni accès à l'application).
 */
export function HtmlFrame({ html, style, onReachEnd, title = '' }: HtmlFrameProps) {
  const handleLoad = useCallback(
    (event: { currentTarget: HTMLIFrameElement }) => {
      if (!onReachEnd) return;
      const win = event.currentTarget.contentWindow;
      const doc = event.currentTarget.contentDocument;
      if (!win || !doc) return;
      const check = () => {
        const root = doc.documentElement;
        if (win.innerHeight + win.scrollY >= root.scrollHeight - 30) onReachEnd();
      };
      win.addEventListener('scroll', check, { passive: true });
      win.setTimeout(check, 600);
    },
    [onReachEnd]
  );

  return createElement('iframe', {
    srcDoc: html,
    title,
    sandbox: 'allow-same-origin',
    onLoad: handleLoad,
    style: { border: 0, width: '100%', height: '100%', background: 'transparent', ...style },
  });
}
