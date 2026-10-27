import { Image, View } from 'react-native';

// Logos fournis par le propriétaire : « m » en forme de voiture sur tuile violette, avec ou sans le nom « m3ak ».
const FULL = require('../../assets/images/logo-m3ak.png');
const MARK = require('../../assets/images/logo-m3ak-mark.png');

const FULL_RATIO = 907 / 850;
const MARK_RATIO = 649 / 630;

type LogoProps = {
  size?: 'md' | 'lg';
  /** Tuile seule, sans le nom (en-têtes, petits espaces). */
  markOnly?: boolean;
};

export function Logo({ size = 'md', markOnly = false }: LogoProps) {
  const width = markOnly ? (size === 'lg' ? 96 : 44) : size === 'lg' ? 220 : 120;
  const ratio = markOnly ? MARK_RATIO : FULL_RATIO;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel="m3ak">
      <Image source={markOnly ? MARK : FULL} style={{ width, height: width / ratio }} resizeMode="contain" />
    </View>
  );
}
