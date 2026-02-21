import { useEffect, useRef, useCallback } from 'react';
import { useMatchStore } from '@/stores/matchStore';

interface UseMatchTimerOptions {
  onComplete: () => void;
  onTick?: (secondsLeft: number) => void;
}

export function useMatchTimer({ onComplete, onTick }: UseMatchTimerOptions) {
  const { activeMatch, setTimeLeft, setRunning } = useMatchStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onTickRef.current = onTick;
  });

  const start = useCallback(() => {
    if (intervalRef.current) return;
    setRunning(true);
    intervalRef.current = setInterval(() => {
      const { activeMatch: current } = useMatchStore.getState();
      if (!current) return;

      const newTime = current.timeLeft - 1;
      setTimeLeft(newTime);
      onTickRef.current?.(newTime);

      if (newTime <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setRunning(false);
        onCompleteRef.current();
      }
    }, 1000);
  }, [setRunning, setTimeLeft]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  }, [setRunning]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { start, stop, timeLeft: activeMatch?.timeLeft ?? 0 };
}
