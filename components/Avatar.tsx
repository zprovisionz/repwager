import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Rect, Ellipse, Path, G } from 'react-native-svg';
import { colors } from '@/lib/theme';

interface AvatarProps {
  gender: 'male' | 'female';
  head?: string;
  torso?: string;
  legs?: string;
  size?: number;
}

const SKIN_TONE = '#F4C28A';
const HAIR_DARK = '#2C1A0E';

function MaleBody({ torso, legs, size }: { torso: string; legs: string; size: number }) {
  const s = size / 100;
  const torsoColor = torso === 'torso_tank' ? '#1a3a6b' : torso === 'torso_hoodie' ? '#1a1a2e' : '#1e3a5f';
  const legsColor = legs === 'legs_joggers' ? '#222' : legs === 'legs_compression' ? '#00D4FF' : '#0f2840';
  return (
    <G>
      <Rect x={35 * s} y={52 * s} width={30 * s} height={28 * s} rx={4 * s} fill={torsoColor} />
      {torso === 'torso_tank' && <Rect x={40 * s} y={52 * s} width={20 * s} height={28 * s} rx={3 * s} fill={torsoColor} />}
      <Rect x={35 * s} y={80 * s} width={13 * s} height={20 * s} rx={3 * s} fill={legsColor} />
      <Rect x={52 * s} y={80 * s} width={13 * s} height={20 * s} rx={3 * s} fill={legsColor} />
      <Rect x={33 * s} y={52 * s} width={8 * s} height={22 * s} rx={4 * s} fill={SKIN_TONE} />
      <Rect x={59 * s} y={52 * s} width={8 * s} height={22 * s} rx={4 * s} fill={SKIN_TONE} />
    </G>
  );
}

function FemaleBody({ torso, legs, size }: { torso: string; legs: string; size: number }) {
  const s = size / 100;
  const torsoColor = torso === 'torso_tank' ? '#c41f5a' : torso === 'torso_hoodie' ? '#1a1a2e' : '#c41f5a';
  const legsColor = legs === 'legs_shorts' ? '#0f2840' : legs === 'legs_compression' ? '#00D4FF' : '#1a1a2e';
  return (
    <G>
      <Rect x={36 * s} y={52 * s} width={28 * s} height={26 * s} rx={4 * s} fill={torsoColor} />
      <Rect x={36 * s} y={78 * s} width={12 * s} height={22 * s} rx={3 * s} fill={legsColor} />
      <Rect x={52 * s} y={78 * s} width={12 * s} height={22 * s} rx={3 * s} fill={legsColor} />
      <Rect x={33 * s} y={52 * s} width={7 * s} height={20 * s} rx={3.5 * s} fill={SKIN_TONE} />
      <Rect x={60 * s} y={52 * s} width={7 * s} height={20 * s} rx={3.5 * s} fill={SKIN_TONE} />
    </G>
  );
}

function MaleHead({ head, size }: { head: string; size: number }) {
  const s = size / 100;
  return (
    <G>
      <Circle cx={50 * s} cy={35 * s} r={16 * s} fill={SKIN_TONE} />
      {head === 'head_default' && (
        <Rect x={34 * s} y={22 * s} width={32 * s} height={10 * s} rx={5 * s} fill={HAIR_DARK} />
      )}
      {head === 'head_bandana' && (
        <Rect x={34 * s} y={25 * s} width={32 * s} height={8 * s} rx={4 * s} fill={colors.secondary} />
      )}
      {head === 'head_headband' && (
        <Rect x={34 * s} y={28 * s} width={32 * s} height={5 * s} rx={2.5 * s} fill={colors.primary} />
      )}
    </G>
  );
}

function FemaleHead({ head, size }: { head: string; size: number }) {
  const s = size / 100;
  return (
    <G>
      <Circle cx={50 * s} cy={35 * s} r={16 * s} fill={SKIN_TONE} />
      {head === 'head_default' && (
        <>
          <Rect x={34 * s} y={22 * s} width={32 * s} height={8 * s} rx={4 * s} fill={HAIR_DARK} />
          <Rect x={60 * s} y={20 * s} width={6 * s} height={22 * s} rx={3 * s} fill={HAIR_DARK} />
        </>
      )}
      {head === 'head_bandana' && (
        <Rect x={34 * s} y={25 * s} width={32 * s} height={8 * s} rx={4 * s} fill={colors.accent} />
      )}
      {head === 'head_bun' && (
        <>
          <Rect x={34 * s} y={22 * s} width={32 * s} height={8 * s} rx={4 * s} fill={HAIR_DARK} />
          <Circle cx={50 * s} cy={20 * s} r={7 * s} fill={HAIR_DARK} />
        </>
      )}
    </G>
  );
}

export default function Avatar({ gender, head = 'head_default', torso = 'torso_default', legs = 'legs_default', size = 80 }: AvatarProps) {
  const s = size / 100;
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 100 100`}>
        {gender === 'male' ? (
          <>
            <MaleBody torso={torso} legs={legs} size={100} />
            <MaleHead head={head} size={100} />
          </>
        ) : (
          <>
            <FemaleBody torso={torso} legs={legs} size={100} />
            <FemaleHead head={head} size={100} />
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
