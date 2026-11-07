import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { IntroVideo } from './intro-video';
import { touchSkips } from './opening-state';
import { useOpeningStatus } from './opening-store';

/**
 * Enveloppe de l'application : pose la vidéo d'ouverture par-dessus l'application (plein écran, fond noir) au lancement
 * à froid. Un toucher la passe ; elle ne bloque jamais l'accès à l'application et s'efface en fondu à la fin.
 */
export function OpeningGate({ children }: { children: ReactNode }) {
  const status = useOpeningStatus();
  const [skipped, setSkipped] = useState(false);

  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={touchSkips(status) && !skipped ? () => setSkipped(true) : undefined}
    >
      {children}
      {status !== 'idle' ? <IntroVideo skipped={skipped} /> : null}
    </View>
  );
}
