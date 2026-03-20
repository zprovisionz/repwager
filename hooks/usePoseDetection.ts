import { useRef, useState, useCallback } from 'react';
import { analyzeRep, type ExerciseType, type RepPhase } from '@/services/poseDetection.service';
import { RepThrottle } from '@/services/repThrottle';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ANGLE_CALIBRATION_OFFSET } from '@/lib/config';

interface UsePoseDetectionOptions {
  exerciseType: ExerciseType;
  onRepCounted: (totalReps: number) => void;
  enabled: boolean;
}

export function usePoseDetection({ exerciseType, onRepCounted, enabled }: UsePoseDetectionOptions) {
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState<RepPhase>('up');
  const [lastRepValid, setLastRepValid] = useState<boolean | null>(null);
  const [calibrationOffset, setCalibrationOffset] = useState(ANGLE_CALIBRATION_OFFSET);
  const throttle = useRef(new RepThrottle());
  const repCountRef = useRef(0);
  const phaseRef = useRef<RepPhase>('up');

  const hasLoadedCalibration = useRef(false);

  if (!hasLoadedCalibration.current) {
    hasLoadedCalibration.current = true;
    AsyncStorage.getItem('repwager:calibration_offset').then((value) => {
      if (value !== null) setCalibrationOffset(Number(value));
    });
  }

  const processFrame = useCallback(
    (pose: { keypoints: { name: string; x: number; y: number; score?: number }[] }) => {
      if (!enabled) return;

      const { newPhase, repCounted, validRep } = analyzeRep(
        pose,
        exerciseType,
        phaseRef.current,
        calibrationOffset
      );

      if (newPhase !== phaseRef.current) {
        phaseRef.current = newPhase;
        setPhase(newPhase);
      }

      if (repCounted) {
        const allowed = throttle.current.canCount();
        if (allowed) {
          repCountRef.current += 1;
          setRepCount(repCountRef.current);
          onRepCounted(repCountRef.current);
          setLastRepValid(true);
        }
      } else if (!validRep) {
        setLastRepValid(false);
      }
    },
    [enabled, exerciseType, onRepCounted, calibrationOffset]
  );

  const manualIncrement = useCallback(() => {
    if (!enabled) return;
    repCountRef.current += 1;
    setRepCount(repCountRef.current);
    setLastRepValid(true);
    onRepCounted(repCountRef.current);
  }, [enabled, onRepCounted]);

  const reset = useCallback(() => {
    repCountRef.current = 0;
    phaseRef.current = 'up';
    setRepCount(0);
    setPhase('up');
    setLastRepValid(null);
    throttle.current.reset();
  }, []);

  return {
    repCount,
    isReady: true,
    phase,
    processFrame,
    manualIncrement,
    reset,
    lastRepValid,
    calibrationOffset,
  };
}
