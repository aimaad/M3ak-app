import { useEffect, useMemo, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';

import { strokeToPath, type HandwrittenSignature, type Point } from './signature';

type PadProps = {
  /** Hauteur fixe ; sans valeur, le cadre occupe tout l'espace disponible (écran sans défilement). */
  height?: number;
  clearLabel: string;
  placeholder: string;
  /** Appelé à chaque modification : tracés (déjà en texte) et taille de la zone. */
  onChange: (paths: string[], size: { width: number; height: number }) => void;
  /** Vrai pendant le tracé : l'écran parent bloque son défilement. Doit être stable (useCallback), sinon le geste est recréé. */
  onDrawingChange?: (drawing: boolean) => void;
};

/** Zone de signature à main levée : un doigt = un trait, bouton Effacer. */
export function SignaturePad({ height, clearLabel, placeholder, onChange, onDrawingChange }: PadProps) {
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [width, setWidth] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(height ?? 0);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          onDrawingChange?.(true);
          const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
          setStrokes((current) => [...current, [point]]);
        },
        onPanResponderMove: (event) => {
          const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
          setStrokes((current) => {
            if (current.length === 0) return current;
            const last = current[current.length - 1];
            return [...current.slice(0, -1), [...last, point]];
          });
        },
        onPanResponderRelease: () => onDrawingChange?.(false),
        onPanResponderTerminate: () => onDrawingChange?.(false),
      }),
    [onDrawingChange]
  );

  const paths = useMemo(() => strokes.map(strokeToPath).filter(Boolean), [strokes]);

  useEffect(() => {
    onChange(paths, { width, height: measuredHeight });
  }, [paths, width, measuredHeight, onChange]);

  return (
    <View className={height ? 'gap-2' : 'flex-1 gap-2'}>
      <View
        {...responder.panHandlers}
        onLayout={(event) => {
          setWidth(Math.round(event.nativeEvent.layout.width));
          setMeasuredHeight(Math.round(event.nativeEvent.layout.height));
        }}
        style={height ? { height } : { flex: 1, minHeight: 160 }}
        className="overflow-hidden rounded-2xl border-2 border-dashed border-[#8A82A0] bg-white"
      >
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
          <Svg width="100%" height="100%">
            {paths.map((d, index) => (
              <Path key={index} d={d} fill="none" stroke="#111111" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </Svg>
        </View>
        {paths.length === 0 ? (
          <View pointerEvents="none" className="flex-1 items-center justify-center px-6">
            <ThemedText type="small" themeColor="textSecondary" className="text-center">
              {placeholder}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <Pressable onPress={() => setStrokes([])} disabled={strokes.length === 0} className="self-end rounded-full border border-[#E4DCF5] bg-white px-4 py-2">
        <ThemedText type="small" style={{ color: strokes.length === 0 ? M3akPalette.mauve : '#211A2E', opacity: strokes.length === 0 ? 0.4 : 1 }}>
          {clearLabel}
        </ThemedText>
      </Pressable>
    </View>
  );
}

/** Affiche une signature enregistrée. */
export function SignatureView({ signature, height = 90 }: { signature: HandwrittenSignature; height?: number }) {
  const width = Math.round((signature.width / signature.height) * height);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${signature.width} ${signature.height}`}>
      {signature.paths.map((d, index) => (
        <Path key={index} d={d} fill="none" stroke="#111111" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}
