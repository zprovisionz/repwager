import { useRef, useState, useCallback } from 'react';
import { analyzeRep, type ExerciseType, type RepPhase } from '@/services/poseDetection.service';
import { RepThrottle } from '@/services/repThrottle';

interface UsePoseDetectionOptions {
  exerciseType: ExerciseType;
  onRepCounted: (totalReps: number) => void;
  enabled: boolean;
}

export function usePoseDetection({ exerciseType, onRepCounted, enabled }: UsePoseDetectionOptions) {
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState<RepPhase>('up');
  const throttle = useRef(new RepThrottle());
  const repCountRef = useRef(0);
  const phaseRef = useRef<RepPhase>('up');

  const processFrame = useCallback(
    (pose: { keypoints: { name: string; x: number; y: number; score?: number }[] }) => {
      if (!enabled) return;

      const { newPhase, repCounted } = analyzeRep(pose, exerciseType, phaseRef.current);

      if (newPhase !== phaseRef.current) {
        phaseRef.current = newPhase;
        setPhase(newPhase);
      }

      if (repCounted && throttle.current.canCount()) {
        repCountRef.current += 1;
        setRepCount(repCountRef.current);
        onRepCounted(repCountRef.current);
      }
    },
    [enabled, exerciseType, onRepCounted]
  );

  const manualIncrement = useCallback(() => {
    if (!enabled) return;
    repCountRef.current += 1;
    setRepCount(repCountRef.current);
    onRepCounted(repCountRef.current);
  }, [enabled, onRepCounted]);

  const reset = useCallback(() => {
    repCountRef.current = 0;
    phaseRef.current = 'up';
    setRepCount(0);
    setPhase('up');
    throttle.current.reset();
  }, []);

  return { repCount, phase, processFrame, manualIncrement, reset };
}
