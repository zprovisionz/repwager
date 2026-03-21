import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Spec URL alias — full win/loss UX (VICTORY/DEFEAT, RC/ELO counters, rematch, Theatre link)
 * lives in `match/reveal.tsx`. This route keeps deep links stable; do not duplicate screens here.
 */
export default function MatchResultAlias() {
  const params = useLocalSearchParams<Record<string, string>>();
  return <Redirect href={{ pathname: '/match/reveal', params }} />;
}
