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
  const throttle = useRef(new RepThrottle());
  const repCountRef = useRef(0);
  const phaseRef = useRef<RepPhase>('up');
  const detectorInitRef = useRef(false);

  console.log('[usePoseDetection] init/render — exerciseType:', exerciseType, '| enabled:', enabled, '| repCount:', repCount, '| phase:', phase, '| isReady:', isReady);

  // Initialize pose detector on first mount
  useEffect(() => {
    if (detectorInitRef.current) return; // Only initialize once
    detectorInitRef.current = true;

    console.log('[usePoseDetection] Initializing pose detector...');
    initializePoseDetector()
      .then(() => {
        console.log('[usePoseDetection] Pose detector ready');
        setIsReady(true);
        setDetectionError(null);
      })
      .catch((error) => {
        console.error('[usePoseDetection] Failed to initialize pose detector:', error);
        setDetectionError(`Pose detection failed: ${error.message}`);
        // Still set ready=true so manual counting works as fallback
        setIsReady(true);
      });

    // Cleanup on unmount
    return () => {
      disposePoseDetector();
    };
  }, []);

  // Process a single frame from camera
  const processFrameFromImage = useCallback(
    async (imageSource: CanvasImageSource | any) => {
      if (!enabled || !isReady) {
        return;
      }

      try {
        // Detect pose from image
        const poses = await detectPose(imageSource);

        if (!poses || poses.length === 0) {
          console.log('[usePoseDetection] No pose detected in frame');
          return;
        }

        const pose = poses[0]; // Single person
        const filteredPose = filterByConfidence(pose, 0.5); // Increase confidence threshold

        const avgConfidence = getAverageConfidence(filteredPose.keypoints || []);
        console.log(
          '[usePoseDetection] Detected pose - confidence:',
          avgConfidence.toFixed(2),
          '| keypoints:',
          filteredPose.keypoints?.length ?? 0
        );

        // Pass to existing processFrame logic
        if (filteredPose.keypoints && filteredPose.keypoints.length > 0) {
          processFrameData(filteredPose);
        }
      } catch (error) {
        console.error('[usePoseDetection] Error processing frame:', error);
        setDetectionError(`Frame processing error: ${(error as Error).message}`);
      }
    },
    [enabled, isReady]
  );

  // Process pose data (extracted from frame or provided directly)
  const processFrameData = useCallback(
    (pose: { keypoints: { name: string; x: number; y: number; score?: number }[] }) => {
      if (!enabled) {
        console.log('[usePoseDetection] processFrameData — skipped, not enabled');
        return;
      }

      const validKeypoints = pose.keypoints.filter((k) => (k.score ?? 0) > 0.3).map((k) => k.name);
      console.log('[usePoseDetection] processFrameData — exercise:', exerciseType, '| phase:', phaseRef.current, '| valid keypoints:', validKeypoints.join(', ') || 'NONE');

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

  // Legacy processFrame for backward compatibility
  const processFrame = useCallback(
    (pose: { keypoints: { name: string; x: number; y: number; score?: number }[] }) => {
      processFrameData(pose);
    },
    [processFrameData]
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
  };
}
