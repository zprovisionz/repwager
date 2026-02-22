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
import {
  DEV_MODE_ENABLED,
  KALMAN_Q,
  KALMAN_R,
  ANGLE_SMOOTHING_FRAMES,
  REP_VELOCITY_MIN_SECONDS,
  REP_VELOCITY_MAX_SECONDS,
  MULTI_REP_VALIDATION_WINDOW,
  MULTI_REP_QUALITY_THRESHOLD,
} from '@/lib/config';
import { KalmanFilter } from '@/utils/kalmanFilter';

interface UsePoseDetectionOptions {
  exerciseType: ExerciseType;
  onRepCounted: (totalReps: number) => void;
  enabled: boolean;
}

// Phase 3: Temporal smoothing data
interface TemporalSmoothingData {
  frameCount: number;
  angleHistory: number[];
  kalmanFilter: KalmanFilter;
  lastRepStartTime: number;
  lastRepEndTime: number;
  multiRepQualityHistory: number[];
}

export function usePoseDetection({ exerciseType, onRepCounted, enabled }: UsePoseDetectionOptions) {
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState<RepPhase>('up');
  const [isReady, setIsReady] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [lastFormQuality, setLastFormQuality] = useState<number | null>(null);
  const [lastFormIssues, setLastFormIssues] = useState<string[]>([]);
  const [velocityWarning, setVelocityWarning] = useState<string | null>(null);
  const throttle = useRef(new RepThrottle());
  const repCountRef = useRef(0);
  const phaseRef = useRef<RepPhase>('up');
  const detectorInitRef = useRef(false);

  // Phase 3: Temporal smoothing refs
  const temporalDataRef = useRef<TemporalSmoothingData>({
    frameCount: 0,
    angleHistory: [],
    kalmanFilter: new KalmanFilter(KALMAN_Q, KALMAN_R),
    lastRepStartTime: 0,
    lastRepEndTime: 0,
    multiRepQualityHistory: [],
  });

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
        // Set error message but still mark as ready so app doesn't hang
        setDetectionError(`Pose detection unavailable: ${(error as Error).message}`);
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

  // Phase 3: Helper function to get smoothed angle using temporal averaging
  const getSmoothedAngle = useCallback((newAngle: number): number => {
    const temporal = temporalDataRef.current;

    // Update Kalman filter with new measurement
    const kalmanSmoothed = temporal.kalmanFilter.update(newAngle);

    // Add to history for moving average
    temporal.angleHistory.push(kalmanSmoothed);
    if (temporal.angleHistory.length > ANGLE_SMOOTHING_FRAMES) {
      temporal.angleHistory.shift();
    }

    // Calculate moving average
    const average = temporal.angleHistory.reduce((a, b) => a + b, 0) / temporal.angleHistory.length;

    if (DEV_MODE_ENABLED && temporal.frameCount % 30 === 0) {
      console.log('[usePoseDetection] Smoothed angle - raw:', newAngle.toFixed(1), 'kalman:', kalmanSmoothed.toFixed(1), 'moving avg:', average.toFixed(1));
    }

    return average;
  }, []);

  // Phase 3: Helper function to detect velocity anomalies
  const checkRepVelocity = useCallback((): string | null => {
    const temporal = temporalDataRef.current;
    const now = Date.now();

    // Only check velocity if we just completed a rep
    if (temporal.lastRepEndTime === 0) return null;

    const repDurationSeconds = (now - temporal.lastRepStartTime) / 1000;

    if (repDurationSeconds < REP_VELOCITY_MIN_SECONDS) {
      return `Rep too fast (${repDurationSeconds.toFixed(2)}s) - possible bouncing`;
    }
    if (repDurationSeconds > REP_VELOCITY_MAX_SECONDS) {
      return `Rep too slow (${repDurationSeconds.toFixed(2)}s) - possible stalling`;
    }

    return null;
  }, []);

  // Phase 3: Helper function to validate multi-rep quality
  const isMultiRepQualityValid = useCallback((newQuality: number): boolean => {
    const temporal = temporalDataRef.current;
    temporal.multiRepQualityHistory.push(newQuality);

    if (temporal.multiRepQualityHistory.length > MULTI_REP_VALIDATION_WINDOW) {
      temporal.multiRepQualityHistory.shift();
    }

    // If we have a full window, check average quality
    if (temporal.multiRepQualityHistory.length === MULTI_REP_VALIDATION_WINDOW) {
      const avgQuality = temporal.multiRepQualityHistory.reduce((a, b) => a + b, 0) / temporal.multiRepQualityHistory.length;
      const isValid = avgQuality >= MULTI_REP_QUALITY_THRESHOLD * 100;

      if (DEV_MODE_ENABLED) {
        console.log('[usePoseDetection] Multi-rep quality check - avg:', avgQuality.toFixed(1), '% - valid:', isValid);
      }

      return isValid;
    }

    // Not enough history yet, allow
    return true;
  }, []);

  const processFrameData = useCallback(
    (pose: { keypoints: { name: string; x: number; y: number; score?: number }[] }) => {
      if (!enabled) return;

      const temporal = temporalDataRef.current;
      temporal.frameCount += 1;

      const { newPhase, repCounted, formQuality, formIssues } = analyzeRep(pose, exerciseType, phaseRef.current);

      if (newPhase !== phaseRef.current) {
        // Phase transition detected
        if (newPhase === 'down') {
          // Just started going down (down phase = active rep)
          temporal.lastRepStartTime = Date.now();
        } else if (newPhase === 'up') {
          // Just completed rep (back to up phase)
          temporal.lastRepEndTime = Date.now();
        }

        phaseRef.current = newPhase;
        setPhase(newPhase);
      }

      if (repCounted) {
        if (formQuality !== undefined) {
          setLastFormQuality(formQuality);
          setLastFormIssues(formIssues ?? []);

          // Phase 3: Check velocity and multi-rep quality
          const velocityWarning = checkRepVelocity();
          setVelocityWarning(velocityWarning);

          // Phase 3: Validate multi-rep quality
          const multiRepValid = isMultiRepQualityValid(formQuality);

          if (!multiRepValid && DEV_MODE_ENABLED) {
            console.log('[usePoseDetection] Multi-rep validation rejected rep due to low avg quality');
          }
        }

        const allowed = throttle.current.canCount();
        if (allowed) {
          repCountRef.current += 1;
          setRepCount(repCountRef.current);
          onRepCounted(repCountRef.current);
        }
      }
    },
    [enabled, exerciseType, onRepCounted, checkRepVelocity, isMultiRepQualityValid]
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
    setVelocityWarning(null);
    throttle.current.reset();

    // Phase 3: Reset temporal smoothing data
    const temporal = temporalDataRef.current;
    temporal.frameCount = 0;
    temporal.angleHistory = [];
    temporal.kalmanFilter.reset();
    temporal.lastRepStartTime = 0;
    temporal.lastRepEndTime = 0;
    temporal.multiRepQualityHistory = [];
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
    velocityWarning, // Phase 3
  };
}
