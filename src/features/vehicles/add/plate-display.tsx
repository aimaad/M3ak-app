import { View } from 'react-native';

import { Brand, HomeFonts } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';

import { plateKind, splitPlate } from './plate';

/**
 * Plaque marocaine en grand (fond blanc, contour 3 px, séparateurs, lettre arabe en Cairo). L'ordre « numéro | lettre | région » ne change
 * jamais, même en arabe. Une plaque d'un autre format est montrée telle quelle dans le même cadre.
 */
export function PlateDisplay({ plate, size = 30 }: { plate: string; size?: number }) {
  const frame = { backgroundColor: Brand.white, borderWidth: 3, borderColor: Brand.graphite, borderRadius: 10, overflow: 'hidden' as const, flexDirection: 'row' as const, alignItems: 'stretch' as const, direction: 'ltr' as const, shadowColor: Brand.white, shadowOpacity: 0, elevation: 0 };
  if (plateKind(plate) !== 'moroccan') {
    return (
      <View style={frame}>
        <HText font="display" weight="bold" size={size} style={{ paddingHorizontal: 16, paddingVertical: 6, lineHeight: size + 10 }}>
          {plate || '—'}
        </HText>
      </View>
    );
  }
  const parts = splitPlate(plate);
  const separator = <View style={{ width: 3, backgroundColor: Brand.graphite }} />;
  return (
    <View style={frame} accessible accessibilityLabel={`${parts.number} ${parts.letter} ${parts.region}`}>
      <HText font="display" weight="bold" size={size} style={{ paddingHorizontal: 16, paddingVertical: 6, lineHeight: size + 10 }}>
        {parts.number}
      </HText>
      {separator}
      <HText style={{ fontFamily: HomeFonts.arabic.bold, fontSize: size, lineHeight: size + 14, paddingHorizontal: 16, paddingVertical: 2 }}>{parts.letter === 'ه' ? 'هـ' : parts.letter}</HText>
      {separator}
      <HText font="display" weight="bold" size={size} style={{ paddingHorizontal: 16, paddingVertical: 6, lineHeight: size + 10 }}>
        {parts.region}
      </HText>
    </View>
  );
}
