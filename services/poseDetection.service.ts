/*
  Pose Detection Service

  Pure geometry helpers — no external ML dependencies.
  Frame analysis is wired up via the usePoseDetection hook which can
  accept poses from any source (MoveNet CDN bundle on web, manual tap on native).
*/

export type ExerciseType = 'push_ups' | 'squats';
export type RepPhase = 'up' | 'down';

export interface Keypoint {
  name: string;
  x: number;
  y: number;
  score?: number;
}

export interface Pose {
  keypoints: Keypoint[];
}

const PUSH_UP_ELBOW_LOCKOUT_ANGLE = 160;
const PUSH_UP_BOTTOM_ANGLE = 90;
const SQUAT_BOTTOM_ANGLE = 90;

// Form validation thresholds
const PUSH_UP_MIN_LOCKOUT_ANGLE = 155; // Minimum lockout (allow slight bend)
const PUSH_UP_MAX_BOTTOM_ANGLE = 100; // Maximum bottom angle (prevent half reps)
const PUSH_UP_MIN_RANGE = 60; // Minimum angle change per rep
const PUSH_UP_BODY_ALIGNMENT_MIN = 160; // Straight body check (shoulder-hip-knee alignment)
const PUSH_UP_KNEE_DOWN_DETECTION = 0.65; // Hip height ratio (knees-down push-ups have lower hips)

const SQUAT_MIN_DEPTH = 85; // Minimum squat depth (knee angle)
const SQUAT_MAX_DEPTH = 50; // Maximum depth (full squat)
const SQUAT_KNEE_TRACKING_TOLERANCE = 20; // Max deviation between left/right knees

const SYMMETRY_TOLERANCE = 20; // Max angle difference between left/right sides

function getAngle(a: Keypoint, b: Keypoint, c: Keypoint): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

function getKeypoint(pose: Pose, name: string): Keypoint | null {
  const kp = pose.keypoints.find((k) => k.name === name);
  return kp && (kp.score ?? 0) > 0.3 ? kp : null;
}

export function analyzePushUp(
  pose: Pose,
  phase: RepPhase
): { newPhase: RepPhase; repCounted: boolean; formQuality?: number; formIssues?: string[] } {
  const lShoulder = getKeypoint(pose, 'left_shoulder');
  const lElbow = getKeypoint(pose, 'left_elbow');
  const lWrist = getKeypoint(pose, 'left_wrist');
  const rShoulder = getKeypoint(pose, 'right_shoulder');
  const rElbow = getKeypoint(pose, 'right_elbow');
  const rWrist = getKeypoint(pose, 'right_wrist');

  if (!lShoulder || !lElbow || !lWrist || !rShoulder || !rElbow || !rWrist) {
    const missing = ['left_shoulder','left_elbow','left_wrist','right_shoulder','right_elbow','right_wrist']
      .filter((_, i) => ![lShoulder, lElbow, lWrist, rShoulder, rElbow, rWrist][i]);
    console.log('[poseDetection] analyzePushUp — missing/low-confidence keypoints:', missing.join(', '));
    return { newPhase: phase, repCounted: false };
  }

  const leftAngle = getAngle(lShoulder, lElbow, lWrist);
  const rightAngle = getAngle(rShoulder, rElbow, rWrist);
  const avgAngle = (leftAngle + rightAngle) / 2;
  console.log('[poseDetection] analyzePushUp — leftAngle:', leftAngle.toFixed(1), '| rightAngle:', rightAngle.toFixed(1), '| avgAngle:', avgAngle.toFixed(1), '| phase:', phase, '| thresholds: bottom <', PUSH_UP_BOTTOM_ANGLE, 'lockout >', PUSH_UP_ELBOW_LOCKOUT_ANGLE);

  if (phase === 'up' && avgAngle < PUSH_UP_BOTTOM_ANGLE) {
    console.log('[poseDetection] analyzePushUp — phase transition: up -> down');
    return { newPhase: 'down', repCounted: false };
  }
  if (phase === 'down' && avgAngle > PUSH_UP_ELBOW_LOCKOUT_ANGLE) {
    const validation = validatePushUpForm(pose, avgAngle, PUSH_UP_ELBOW_LOCKOUT_ANGLE);
    return { newPhase: 'up', repCounted: true, formQuality: validation.quality, formIssues: validation.issues };
  }
  return { newPhase: phase, repCounted: false };
}

export function analyzeSquat(
  pose: Pose,
  phase: RepPhase
): { newPhase: RepPhase; repCounted: boolean; formQuality?: number; formIssues?: string[] } {
  const lHip = getKeypoint(pose, 'left_hip');
  const lKnee = getKeypoint(pose, 'left_knee');
  const lAnkle = getKeypoint(pose, 'left_ankle');
  const rHip = getKeypoint(pose, 'right_hip');
  const rKnee = getKeypoint(pose, 'right_knee');
  const rAnkle = getKeypoint(pose, 'right_ankle');

  if (!lHip || !lKnee || !lAnkle || !rHip || !rKnee || !rAnkle) {
    const missing = ['left_hip','left_knee','left_ankle','right_hip','right_knee','right_ankle']
      .filter((_, i) => ![lHip, lKnee, lAnkle, rHip, rKnee, rAnkle][i]);
    console.log('[poseDetection] analyzeSquat — missing/low-confidence keypoints:', missing.join(', '));
    return { newPhase: phase, repCounted: false };
  }

  const leftAngle = getAngle(lHip, lKnee, lAnkle);
  const rightAngle = getAngle(rHip, rKnee, rAnkle);
  const avgAngle = (leftAngle + rightAngle) / 2;
  console.log('[poseDetection] analyzeSquat — leftAngle:', leftAngle.toFixed(1), '| rightAngle:', rightAngle.toFixed(1), '| avgAngle:', avgAngle.toFixed(1), '| phase:', phase, '| thresholds: bottom <', SQUAT_BOTTOM_ANGLE, 'lockout > 120');

  if (phase === 'up' && avgAngle < SQUAT_BOTTOM_ANGLE) {
    console.log('[poseDetection] analyzeSquat — phase transition: up -> down');
    return { newPhase: 'down', repCounted: false };
  }
  if (phase === 'down' && avgAngle > 120) {
    const validation = validateSquatForm(pose, avgAngle);
    return { newPhase: 'up', repCounted: true, formQuality: validation.quality, formIssues: validation.issues };
  }
  return { newPhase: phase, repCounted: false };
}

/**
 * Validate push-up form quality
 * Checks for proper range of motion, body alignment, and prevents cheating
 * @returns Form quality score (0-100, where 100 is perfect form)
 */
export function validatePushUpForm(pose: Pose, bottomAngle: number, lockoutAngle: number): {
  isValid: boolean;
  quality: number;
  issues: string[];
} {
  const issues: string[] = [];
  let qualityDeductions = 0;

  // Check range of motion
  const rangeOfMotion = Math.abs(lockoutAngle - bottomAngle);
  if (rangeOfMotion < PUSH_UP_MIN_RANGE) {
    issues.push('Incomplete range of motion');
    qualityDeductions += 30;
  }

  // Check bottom position (should be ~90° or lower)
  if (bottomAngle > PUSH_UP_MAX_BOTTOM_ANGLE) {
    issues.push('Not lowering far enough (half rep)');
    qualityDeductions += 25;
  }

  // Check lockout position (should be ~160° or higher)
  if (lockoutAngle < PUSH_UP_MIN_LOCKOUT_ANGLE) {
    issues.push('Not fully extending at top');
    qualityDeductions += 20;
  }

  // Check body alignment (shoulder-hip-knee should be straight)
  const lShoulder = getKeypoint(pose, 'left_shoulder');
  const lHip = getKeypoint(pose, 'left_hip');
  const lKnee = getKeypoint(pose, 'left_knee');
  const rShoulder = getKeypoint(pose, 'right_shoulder');
  const rHip = getKeypoint(pose, 'right_hip');
  const rKnee = getKeypoint(pose, 'right_knee');

  if (lShoulder && lHip && lKnee) {
    const leftBodyAlignment = getAngle(lShoulder, lHip, lKnee);
    if (leftBodyAlignment < PUSH_UP_BODY_ALIGNMENT_MIN) {
      issues.push('Keep body straight (avoid sagging hips)');
      qualityDeductions += 15;
    }
  }

  if (rShoulder && rHip && rKnee) {
    const rightBodyAlignment = getAngle(rShoulder, rHip, rKnee);
    if (rightBodyAlignment < PUSH_UP_BODY_ALIGNMENT_MIN) {
      issues.push('Keep body straight (avoid sagging hips)');
      qualityDeductions += 15;
    }
  }

  // Check for knee push-ups (hips too low relative to shoulders)
  if (lShoulder && lHip && rShoulder && rHip) {
    const avgShoulderHeight = (lShoulder.y + rShoulder.y) / 2;
    const avgHipHeight = (lHip.y + rHip.y) / 2;
    const hipHeightRatio = Math.abs(avgHipHeight - avgShoulderHeight) / avgShoulderHeight;

    if (hipHeightRatio > PUSH_UP_KNEE_DOWN_DETECTION) {
      issues.push('Full push-up detected (not on knees)');
    }
  }

  // Check for asymmetry (left vs right sides)
  const lElbow = getKeypoint(pose, 'left_elbow');
  const rElbow = getKeypoint(pose, 'right_elbow');
  const lWrist = getKeypoint(pose, 'left_wrist');
  const rWrist = getKeypoint(pose, 'right_wrist');

  if (lShoulder && lElbow && lWrist && rShoulder && rElbow && rWrist) {
    const leftAngle = getAngle(lShoulder, lElbow, lWrist);
    const rightAngle = getAngle(rShoulder, rElbow, rWrist);
    const angleAsymmetry = Math.abs(leftAngle - rightAngle);

    if (angleAsymmetry > SYMMETRY_TOLERANCE) {
      issues.push('Uneven elbow angles (favor one side)');
      qualityDeductions += 10;
    }
  }

  const quality = Math.max(0, 100 - qualityDeductions);
  const isValid = quality >= 75; // 75% is competitive minimum

  return { isValid, quality, issues };
}

/**
 * Validate squat form quality
 * Checks for proper depth, knee tracking, and back alignment
 * @returns Form quality score (0-100, where 100 is perfect form)
 */
export function validateSquatForm(pose: Pose, bottomAngle: number): {
  isValid: boolean;
  quality: number;
  issues: string[];
} {
  const issues: string[] = [];
  let qualityDeductions = 0;

  const lHip = getKeypoint(pose, 'left_hip');
  const lKnee = getKeypoint(pose, 'left_knee');
  const lAnkle = getKeypoint(pose, 'left_ankle');
  const rHip = getKeypoint(pose, 'right_hip');
  const rKnee = getKeypoint(pose, 'right_knee');
  const rAnkle = getKeypoint(pose, 'right_ankle');

  // Check squat depth (should be 90° or lower for parallel/below-parallel)
  if (bottomAngle > SQUAT_MIN_DEPTH) {
    issues.push('Not squatting deep enough (quarter squat)');
    qualityDeductions += 30;
  }

  // Check for excessive depth (prevent knee strain)
  if (bottomAngle < SQUAT_MAX_DEPTH) {
    issues.push('Going too deep (risk of injury)');
    qualityDeductions += 15;
  }

  // Check knee tracking (knees should track over toes)
  if (lKnee && lAnkle && rKnee && rAnkle) {
    const leftKneeTracking = Math.abs(lKnee.x - lAnkle.x);
    const rightKneeTracking = Math.abs(rKnee.x - rAnkle.x);

    if (leftKneeTracking > 30) {
      issues.push('Left knee caving inward');
      qualityDeductions += 15;
    }
    if (rightKneeTracking > 30) {
      issues.push('Right knee caving inward');
      qualityDeductions += 15;
    }
  }

  // Check bilateral symmetry (left vs right knees)
  if (lHip && lKnee && lAnkle && rHip && rKnee && rAnkle) {
    const leftAngle = getAngle(lHip, lKnee, lAnkle);
    const rightAngle = getAngle(rHip, rKnee, rAnkle);
    const kneeAsymmetry = Math.abs(leftAngle - rightAngle);

    if (kneeAsymmetry > SQUAT_KNEE_TRACKING_TOLERANCE) {
      issues.push('Uneven squat depth (one leg deeper)');
      qualityDeductions += 10;
    }
  }

  // Check back alignment (hip-knee angle should show upright torso)
  if (lHip && lKnee && rHip && rKnee) {
    const leftTorsoAngle = lHip.y - lKnee.y; // Vertical distance
    const rightTorsoAngle = rHip.y - rKnee.y;
    const avgTorsoAngle = (leftTorsoAngle + rightTorsoAngle) / 2;

    if (avgTorsoAngle < 50) {
      // If vertical distance is very small, torso is leaning too far forward
      issues.push('Chest leaning too far forward');
      qualityDeductions += 15;
    }
  }

  const quality = Math.max(0, 100 - qualityDeductions);
  const isValid = quality >= 75; // 75% is competitive minimum

  return { isValid, quality, issues };
}

export function analyzeRep(
  pose: Pose,
  exerciseType: ExerciseType,
  phase: RepPhase
): { newPhase: RepPhase; repCounted: boolean; formQuality?: number; formIssues?: string[] } {
  if (exerciseType === 'push_ups') return analyzePushUp(pose, phase);
  return analyzeSquat(pose, phase);
}
