import { useRef, useState, useCallback, useEffect } from 'react';
import { analyzeRep, type ExerciseType, type RepPhase } from '@/services/poseDetection.service';
import { RepThrottle } from '@/services/repThrottle';
import {
  initializePoseDetector,
  detectPose,
  filterByConfidence,
  disposePoseDetector,
  getAverageConfidence,
} from '@/services/mediapipe.service';
import { DEV_MODE_ENABLED } from '@/lib/config';

interface UsePoseDetectionOptions {
  exerciseType: ExerciseType;
  onRepCounted: (totalReps: number) => void;
  enabled: boolean;
}

export function usePoseDetection({ exerciseType, onRepCounted, enabled }: UsePoseDetectionOptions) {
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState<RepPhase>('up');
  const [isReady, setIsReady] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [lastFormQuality, setLastFormQuality] = useState<number | null>(null);
  const [lastFormIssues, setLastFormIssues] = useState<string[]>([]);
  const throttle = useRef(new RepThrottle());
  const repCountRef = useRef(0);
  const phaseRef = useRef<RepPhase>('up');
  const detectorInitRef = useRef(false);

  useEffect(() => {
    if (detectorInitRef.current) return;
    detectorInitRef.current = true;

    initializePoseDetector()
      .then(() => {
        setIsReady(true);
        setDetectionError(null);
      })
      .catch((error) => {
        if (DEV_MODE_ENABLED) console.error('[usePoseDetection] Failed to initialize pose detector:', error);
        setDetectionError(`Pose detection failed: ${error.message}`);
        setIsReady(true);
      });

    return () => {
      disposePoseDetector();
    };
  }, []);

  const processFrameFromImage = useCallback(
    async (imageSource: CanvasImageSource | any) => {
      if (!enabled || !isReady) return;

      try {
        const poses = await detectPose(imageSource);
        if (!poses || poses.length === 0) return;

        const pose = poses[0];
        const filteredPose = filterByConfidence(pose, 0.5);

        if (DEV_MODE_ENABLED) {
          const avgConfidence = getAverageConfidence(filteredPose.keypoints || []);
          console.log('[usePoseDetection] Detected pose - confidence:', avgConfidence.toFixed(2));
        }

        if (filteredPose.keypoints && filteredPose.keypoints.length > 0) {
          processFrameData(filteredPose);
        }
      } catch (error) {
        if (DEV_MODE_ENABLED) console.error('[usePoseDetection] Error processing frame:', error);
        setDetectionError(`Frame processing error: ${(error as Error).message}`);
      }
    },
    [enabled, isReady]
  );

  const processFrameData = useCallback(
    (pose: { keypoints: { name: string; x: number; y: number; score?: number }[] }) => {
      if (!enabled) return;

      const { newPhase, repCounted, formQuality, formIssues } = analyzeRep(pose, exerciseType, phaseRef.current);

      if (newPhase !== phaseRef.current) {
        phaseRef.current = newPhase;
        setPhase(newPhase);
      }

      if (repCounted) {
        if (formQuality !== undefined) {
          setLastFormQuality(formQuality);
          setLastFormIssues(formIssues ?? []);
        }
        const allowed = throttle.current.canCount();
        if (allowed) {
          repCountRef.current += 1;
          setRepCount(repCountRef.current);
          onRepCounted(repCountRef.current);
        }
      }
    },
    [enabled, exerciseType, onRepCounted]
  );

  const processFrame = useCallback(
    (pose: { keypoints: { name: string; x: number; y: number; score?: number }[] }) => {
      processFrameData(pose);
    },
    [processFrameData]
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
    setLastFormQuality(null);
    setLastFormIssues([]);
    throttle.current.reset();
  }, []);

  return {
    repCount,
    isReady,
    phase,
    processFrame,
    processFrameFromImage,
    processFrameData,
    manualIncrement,
    reset,
    detectionError,
    lastFormQuality,
    lastFormIssues,
  };
}
