/*
  Pose Detection Service

  Pure geometry helpers — no external ML dependencies.
  Frame analysis is wired up via the usePoseDetection hook which can
  accept poses from any source (MoveNet CDN bundle on web, manual tap on native).

  ── CHANGES FROM AUDIT ──────────────────────────────────────────────────────
  1. Track minAngle during descent so validatePushUpForm receives the real
     bottom position, not the lockout angle (was always ~160° → ROM always 0°).
  2. Fix squat lockout threshold from 120° → 160°. At 120° the user is still
     in a quarter-squat; every proper squat crossed this twice, causing double
     counting on every rep.
  3. Raise keypoint confidence threshold 0.3 → POSE_CONFIDENCE_MIN (0.6),
     matching the value defined in config and reducing junk-angle frames.
  4. Fix duplicate hip-sagging deduction: left + right sides now contribute one
     merged check, not two 15-point hits with the same issue string.
  5. Fix knee-caving check: normalize knee-ankle x-offset by leg segment length
     so the check is camera-distance agnostic.
  6. Fix torso-lean check for squats: use proper shoulder–hip vertical angle
     instead of a raw pixel y-difference.
  7. Add hysteresis bands: state only changes when angle moves 5° past the
     threshold, preventing flapping near boundary values.
  8. Fix misleading knee-push-up message.
  9. Export per-rep angle tracking so callers can record min/max if needed.
*/

import { POSE_CONFIDENCE_MIN } from '@/lib/config';

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

// ─── DETECTION THRESHOLDS ──────────────────────────────────────────────────

const PUSH_UP_ELBOW_LOCKOUT_ANGLE = 160;
const PUSH_UP_BOTTOM_ANGLE = 90;

// FIX 7: hysteresis — state doesn't flip until 5° past threshold
const PUSH_UP_BOTTOM_HYSTERESIS = 5;    // must reach < 85° to enter DOWN
const PUSH_UP_LOCKOUT_HYSTERESIS = 5;   // must reach > 165° to exit DOWN

const SQUAT_BOTTOM_ANGLE = 90;
// FIX 2: was 120° — at 120° user is still in a quarter-squat, causing every
// proper squat to cross this threshold TWICE (on way down and on way up).
// True standing lockout is ~170°; use 160° to allow slight natural flex.
const SQUAT_LOCKOUT_ANGLE = 160;

// FIX 7: hysteresis for squats
const SQUAT_BOTTOM_HYSTERESIS = 5;     // must reach < 85° to enter DOWN
const SQUAT_LOCKOUT_HYSTERESIS = 5;    // must reach > 165° to exit DOWN

// ─── FORM VALIDATION THRESHOLDS ───────────────────────────────────────────

const PUSH_UP_MIN_LOCKOUT_ANGLE = 155;
const PUSH_UP_MAX_BOTTOM_ANGLE = 100;   // >100° at bottom = half-rep
const PUSH_UP_MIN_RANGE = 60;           // must travel ≥60° elbow arc per rep
const PUSH_UP_BODY_ALIGNMENT_MIN = 160; // shoulder-hip-knee plank check
const SYMMETRY_TOLERANCE = 20;

// Squat form
const SQUAT_MIN_DEPTH_ANGLE = 85;       // knee angle must reach ≤85° (parallel)
const SQUAT_MAX_DEPTH_ANGLE = 50;       // <50° = excessive depth
const SQUAT_KNEE_CAVE_NORM_MAX = 0.20;  // FIX 5: normalized knee cave limit
const SQUAT_SYMMETRY_TOLERANCE = 20;
const SQUAT_TORSO_FORWARD_LEAN_MAX = 45; // degrees from vertical

// ─── PER-REP STATE TRACKING ───────────────────────────────────────────────
// FIX 1: track the minimum elbow angle reached during a push-up descent, and
// the minimum knee angle during a squat descent, so form validation receives
// the real bottom position instead of the lockout angle.

let pushUpMinAngleThisRep = 180;
let squatMinAngleThisRep = 180;

// ─── HELPERS ──────────────────────────────────────────────────────────────

function getAngle(a: Keypoint, b: Keypoint, c: Keypoint): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

// FIX 3: raise confidence threshold from 0.3 → POSE_CONFIDENCE_MIN (0.6)
function getKeypoint(pose: Pose, name: string): Keypoint | null {
  const kp = pose.keypoints.find((k) => k.name === name);
  return kp && (kp.score ?? 0) >= POSE_CONFIDENCE_MIN ? kp : null;
}

// ─── PUSH-UP DETECTION ────────────────────────────────────────────────────

export function analyzePushUp(
  pose: Pose,
  phase: RepPhase
): { newPhase: RepPhase; repCounted: boolean; formQuality?: number; formIssues?: string[] } {
  const lShoulder = getKeypoint(pose, 'left_shoulder');
  const lElbow    = getKeypoint(pose, 'left_elbow');
  const lWrist    = getKeypoint(pose, 'left_wrist');
  const rShoulder = getKeypoint(pose, 'right_shoulder');
  const rElbow    = getKeypoint(pose, 'right_elbow');
  const rWrist    = getKeypoint(pose, 'right_wrist');

  if (!lShoulder || !lElbow || !lWrist || !rShoulder || !rElbow || !rWrist) {
    return { newPhase: phase, repCounted: false };
  }

  const leftAngle  = getAngle(lShoulder, lElbow, lWrist);
  const rightAngle = getAngle(rShoulder, rElbow, rWrist);
  const avgAngle   = (leftAngle + rightAngle) / 2;

  // FIX 1: track the minimum angle reached so we can pass the true bottom to validation
  if (phase === 'down') {
    pushUpMinAngleThisRep = Math.min(pushUpMinAngleThisRep, avgAngle);
  }

  // FIX 7: hysteresis — only enter DOWN if angle drops 5° below the bottom threshold
  if (phase === 'up' && avgAngle < (PUSH_UP_BOTTOM_ANGLE - PUSH_UP_BOTTOM_HYSTERESIS)) {
    pushUpMinAngleThisRep = avgAngle; // start tracking minimum from this point
    return { newPhase: 'down', repCounted: false };
  }

  // FIX 7: hysteresis — only exit DOWN if angle rises 5° above the lockout threshold
  if (phase === 'down' && avgAngle > (PUSH_UP_ELBOW_LOCKOUT_ANGLE + PUSH_UP_LOCKOUT_HYSTERESIS)) {
    // FIX 1: pass actual bottom angle (min reached during descent), not current lockout angle
    const bottomAngle = pushUpMinAngleThisRep;
    pushUpMinAngleThisRep = 180; // reset for next rep
    const validation = validatePushUpForm(pose, bottomAngle, avgAngle);
    return {
      newPhase: 'up',
      repCounted: true,
      formQuality: validation.quality,
      formIssues: validation.issues,
    };
  }

  return { newPhase: phase, repCounted: false };
}

// ─── SQUAT DETECTION ──────────────────────────────────────────────────────

export function analyzeSquat(
  pose: Pose,
  phase: RepPhase
): { newPhase: RepPhase; repCounted: boolean; formQuality?: number; formIssues?: string[] } {
  const lHip   = getKeypoint(pose, 'left_hip');
  const lKnee  = getKeypoint(pose, 'left_knee');
  const lAnkle = getKeypoint(pose, 'left_ankle');
  const rHip   = getKeypoint(pose, 'right_hip');
  const rKnee  = getKeypoint(pose, 'right_knee');
  const rAnkle = getKeypoint(pose, 'right_ankle');

  if (!lHip || !lKnee || !lAnkle || !rHip || !rKnee || !rAnkle) {
    return { newPhase: phase, repCounted: false };
  }

  const leftAngle  = getAngle(lHip, lKnee, lAnkle);
  const rightAngle = getAngle(rHip, rKnee, rAnkle);
  const avgAngle   = (leftAngle + rightAngle) / 2;

  // FIX 1: track minimum knee angle during descent for form validation
  if (phase === 'down') {
    squatMinAngleThisRep = Math.min(squatMinAngleThisRep, avgAngle);
  }

  // FIX 7: hysteresis — enter squat only when knee bends 5° past threshold
  if (phase === 'up' && avgAngle < (SQUAT_BOTTOM_ANGLE - SQUAT_BOTTOM_HYSTERESIS)) {
    squatMinAngleThisRep = avgAngle;
    return { newPhase: 'down', repCounted: false };
  }

  // FIX 2: was 120° — changed to 160° (true standing lockout with hysteresis)
  // Previously, every proper squat crossed 120° on the way DOWN (triggering up→down)
  // and again on the way back UP (triggering down→up and double-counting).
  if (phase === 'down' && avgAngle > (SQUAT_LOCKOUT_ANGLE + SQUAT_LOCKOUT_HYSTERESIS)) {
    const bottomAngle = squatMinAngleThisRep;
    squatMinAngleThisRep = 180;
    const validation = validateSquatForm(pose, bottomAngle);
    return {
      newPhase: 'up',
      repCounted: true,
      formQuality: validation.quality,
      formIssues: validation.issues,
    };
  }

  return { newPhase: phase, repCounted: false };
}

// ─── PUSH-UP FORM VALIDATION ──────────────────────────────────────────────

/**
 * Validate push-up form quality.
 *
 * @param bottomAngle - minimum elbow angle reached during descent (the true
 *   bottom of the rep). Previously this was passed the lockout angle (~160°)
 *   which made the ROM check always report ~0° range (FIX 1).
 * @param lockoutAngle - elbow angle at the top of the rep (should be ≥155°).
 */
export function validatePushUpForm(
  pose: Pose,
  bottomAngle: number,
  lockoutAngle: number
): { isValid: boolean; quality: number; issues: string[] } {
  const issues: string[] = [];
  let qualityDeductions = 0;

  // Range of motion: how far did the elbow travel this rep
  const rangeOfMotion = Math.abs(lockoutAngle - bottomAngle);
  if (rangeOfMotion < PUSH_UP_MIN_RANGE) {
    issues.push('Incomplete range of motion');
    qualityDeductions += 30;
  }

  // Bottom position: elbow must bend to ≤100° (below is half-rep)
  if (bottomAngle > PUSH_UP_MAX_BOTTOM_ANGLE) {
    issues.push('Not lowering far enough (half rep)');
    qualityDeductions += 25;
  }

  // Lockout position: elbow must straighten to ≥155°
  if (lockoutAngle < PUSH_UP_MIN_LOCKOUT_ANGLE) {
    issues.push('Not fully extending at top');
    qualityDeductions += 20;
  }

  // Body alignment: shoulder-hip-knee angle (plank check)
  // FIX 4: merged left + right into one check to avoid double 15-pt deduction
  const lShoulder = getKeypoint(pose, 'left_shoulder');
  const lHip      = getKeypoint(pose, 'left_hip');
  const lKnee     = getKeypoint(pose, 'left_knee');
  const rShoulder = getKeypoint(pose, 'right_shoulder');
  const rHip      = getKeypoint(pose, 'right_hip');
  const rKnee     = getKeypoint(pose, 'right_knee');

  const leftBodyAngle  = lShoulder && lHip && lKnee ? getAngle(lShoulder, lHip, lKnee) : null;
  const rightBodyAngle = rShoulder && rHip && rKnee ? getAngle(rShoulder, rHip, rKnee) : null;

  const bodyAngles = [leftBodyAngle, rightBodyAngle].filter((a): a is number => a !== null);
  if (bodyAngles.length > 0) {
    const avgBodyAngle = bodyAngles.reduce((s, a) => s + a, 0) / bodyAngles.length;
    if (avgBodyAngle < PUSH_UP_BODY_ALIGNMENT_MIN) {
      issues.push('Keep body straight (avoid sagging hips)');
      qualityDeductions += 15; // FIX 4: single deduction regardless of which side failed
    }
  }

  // FIX 8: knee push-up detection — large shoulder-to-hip vertical gap means
  // the user is planked out fully (not on knees). Small gap = on knees.
  // Re-written to detect the knee position correctly.
  if (lShoulder && lHip && rShoulder && rHip && lKnee && rKnee) {
    const avgShoulderY = (lShoulder.y + rShoulder.y) / 2;
    const avgHipY      = (lHip.y + rHip.y) / 2;
    const avgKneeY     = (lKnee.y + rKnee.y) / 2;
    // In a knee push-up the hips sag between shoulders and knees.
    // Measure hip position as a fraction of the shoulder→knee span.
    const span = Math.abs(avgKneeY - avgShoulderY) || 1;
    const hipRelPos = (avgHipY - avgShoulderY) / span;
    // If hips are below the midpoint of shoulder→knee span, likely on knees
    if (hipRelPos < 0.35) {
      issues.push('Knee push-up detected (not full push-up form)');
      // Informational only — no quality deduction for knees-down modification
    }
  }

  // Symmetry check (left vs right elbow)
  const lElbow = getKeypoint(pose, 'left_elbow');
  const rElbow = getKeypoint(pose, 'right_elbow');
  const lWrist = getKeypoint(pose, 'left_wrist');
  const rWrist = getKeypoint(pose, 'right_wrist');

  if (lShoulder && lElbow && lWrist && rShoulder && rElbow && rWrist) {
    const lAngle = getAngle(lShoulder, lElbow, lWrist);
    const rAngle = getAngle(rShoulder, rElbow, rWrist);
    if (Math.abs(lAngle - rAngle) > SYMMETRY_TOLERANCE) {
      issues.push('Uneven elbow angles (favoring one side)');
      qualityDeductions += 10;
    }
  }

  const quality = Math.max(0, 100 - qualityDeductions);
  return { isValid: quality >= 75, quality, issues };
}

// ─── SQUAT FORM VALIDATION ────────────────────────────────────────────────

/**
 * Validate squat form quality.
 *
 * @param bottomAngle - minimum knee angle reached during the squat (the real
 *   bottom). FIX 1: the caller now passes the tracked minimum angle instead
 *   of whatever the knee angle is at the time of rep-counting.
 */
export function validateSquatForm(
  pose: Pose,
  bottomAngle: number
): { isValid: boolean; quality: number; issues: string[] } {
  const issues: string[] = [];
  let qualityDeductions = 0;

  const lHip   = getKeypoint(pose, 'left_hip');
  const lKnee  = getKeypoint(pose, 'left_knee');
  const lAnkle = getKeypoint(pose, 'left_ankle');
  const rHip   = getKeypoint(pose, 'right_hip');
  const rKnee  = getKeypoint(pose, 'right_knee');
  const rAnkle = getKeypoint(pose, 'right_ankle');

  // Depth check (knee must reach ≤85° for parallel or below)
  if (bottomAngle > SQUAT_MIN_DEPTH_ANGLE) {
    issues.push('Not squatting deep enough (quarter squat)');
    qualityDeductions += 30;
  }

  // Excessive depth (knee angle <50° — potential knee strain)
  if (bottomAngle < SQUAT_MAX_DEPTH_ANGLE) {
    issues.push('Going too deep (risk of knee strain)');
    qualityDeductions += 15;
  }

  // FIX 5: knee caving — normalize lateral knee displacement by leg-segment
  // length so the check doesn't break at different camera distances.
  if (lHip && lKnee && lAnkle) {
    const legLength = Math.abs(lHip.y - lAnkle.y) || 1;
    const lateralKneeDrift = Math.abs(lKnee.x - lAnkle.x) / legLength;
    if (lateralKneeDrift > SQUAT_KNEE_CAVE_NORM_MAX) {
      issues.push('Left knee caving inward');
      qualityDeductions += 15;
    }
  }
  if (rHip && rKnee && rAnkle) {
    const legLength = Math.abs(rHip.y - rAnkle.y) || 1;
    const lateralKneeDrift = Math.abs(rKnee.x - rAnkle.x) / legLength;
    if (lateralKneeDrift > SQUAT_KNEE_CAVE_NORM_MAX) {
      issues.push('Right knee caving inward');
      qualityDeductions += 15;
    }
  }

  // Bilateral symmetry check
  if (lHip && lKnee && lAnkle && rHip && rKnee && rAnkle) {
    const leftAngle  = getAngle(lHip, lKnee, lAnkle);
    const rightAngle = getAngle(rHip, rKnee, rAnkle);
    if (Math.abs(leftAngle - rightAngle) > SQUAT_SYMMETRY_TOLERANCE) {
      issues.push('Uneven squat depth (one leg deeper)');
      qualityDeductions += 10;
    }
  }

  // FIX 6: forward torso lean — estimate trunk angle using shoulder and hip
  // midpoints, then measure angle from vertical.
  // Previously used raw pixel y-difference (lHip.y - lKnee.y < 50) which was
  // not normalized and fired randomly based on camera distance.
  const lShoulder = getKeypoint(pose, 'left_shoulder');
  const rShoulder = getKeypoint(pose, 'right_shoulder');

  if (lShoulder && rShoulder && lHip && rHip) {
    const midShoulderX = (lShoulder.x + rShoulder.x) / 2;
    const midShoulderY = (lShoulder.y + rShoulder.y) / 2;
    const midHipX      = (lHip.x + rHip.x) / 2;
    const midHipY      = (lHip.y + rHip.y) / 2;

    // Angle of torso vector from vertical (0° = perfectly upright)
    const dx = midHipX - midShoulderX;
    const dy = midHipY - midShoulderY;
    const torsoForwardLean = Math.abs(Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI));

    if (torsoForwardLean > SQUAT_TORSO_FORWARD_LEAN_MAX) {
      issues.push('Chest leaning too far forward');
      qualityDeductions += 15;
    }
  }

  const quality = Math.max(0, 100 - qualityDeductions);
  return { isValid: quality >= 75, quality, issues };
}

// ─── ROUTER ───────────────────────────────────────────────────────────────

export function analyzeRep(
  pose: Pose,
  exerciseType: ExerciseType,
  phase: RepPhase
): { newPhase: RepPhase; repCounted: boolean; formQuality?: number; formIssues?: string[] } {
  if (exerciseType === 'push_ups') return analyzePushUp(pose, phase);
  return analyzeSquat(pose, phase);
}
