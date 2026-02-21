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

  console.log('[usePoseDetection] init/render — exerciseType:', exerciseType, '| enabled:', enabled, '| repCount:', repCount, '| phase:', phase);

  const processFrame = useCallback(
    (pose: { keypoints: { name: string; x: number; y: number; score?: number }[] }) => {
      if (!enabled) {
        console.log('[usePoseDetection] processFrame — skipped, not enabled');
        return;
      }

      const validKeypoints = pose.keypoints.filter((k) => (k.score ?? 0) > 0.3).map((k) => k.name);
      console.log('[usePoseDetection] processFrame — exercise:', exerciseType, '| phase:', phaseRef.current, '| valid keypoints:', validKeypoints.join(', ') || 'NONE');

      const { newPhase, repCounted } = analyzeRep(pose, exerciseType, phaseRef.current);

      if (newPhase !== phaseRef.current) {
        console.log('[usePoseDetection] phase change:', phaseRef.current, '->', newPhase);
        phaseRef.current = newPhase;
        setPhase(newPhase);
      }

      if (repCounted) {
        const allowed = throttle.current.canCount();
        console.log('[usePoseDetection] repCounted=true | throttle allowed:', allowed, '| repCountRef:', repCountRef.current);
        if (allowed) {
          repCountRef.current += 1;
          setRepCount(repCountRef.current);
          onRepCounted(repCountRef.current);
        }
      }
    },
    [enabled, exerciseType, onRepCounted]
  );

  const manualIncrement = useCallback(() => {
    console.log('[usePoseDetection] manualIncrement — enabled:', enabled, '| current count:', repCountRef.current);
    if (!enabled) {
      console.warn('[usePoseDetection] manualIncrement blocked — not enabled');
      return;
    }
    repCountRef.current += 1;
    console.log('[usePoseDetection] manualIncrement — new count:', repCountRef.current);
    setRepCount(repCountRef.current);
    onRepCounted(repCountRef.current);
  }, [enabled, onRepCounted]);

  const reset = useCallback(() => {
    console.log('[usePoseDetection] reset — clearing rep count and phase');
    repCountRef.current = 0;
    phaseRef.current = 'up';
    setRepCount(0);
    setPhase('up');
    throttle.current.reset();
  }, []);

  return { repCount, isReady: true, phase, processFrame, manualIncrement, reset };
}
