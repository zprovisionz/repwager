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

export interface RepAnalysisResult {
  newPhase: RepPhase;
  repCounted: boolean;
  validRep: boolean;
  elbowAngle: number;
  shoulderAngle: number;
}

const PUSH_UP_ELBOW_LOCKOUT_ANGLE = 160;
const PUSH_UP_BOTTOM_ANGLE = 90;
const SQUAT_BOTTOM_ANGLE = 90;

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
  phase: RepPhase,
  calibrationOffset = 0
): RepAnalysisResult {
  const lShoulder = getKeypoint(pose, 'left_shoulder');
  const lElbow = getKeypoint(pose, 'left_elbow');
  const lWrist = getKeypoint(pose, 'left_wrist');
  const rShoulder = getKeypoint(pose, 'right_shoulder');
  const rElbow = getKeypoint(pose, 'right_elbow');
  const rWrist = getKeypoint(pose, 'right_wrist');

  if (!lShoulder || !lElbow || !lWrist || !rShoulder || !rElbow || !rWrist) {
    return { newPhase: phase, repCounted: false, validRep: false, elbowAngle: 0, shoulderAngle: 0 };
  }

  const leftAngle = getAngle(lShoulder, lElbow, lWrist);
  const rightAngle = getAngle(rShoulder, rElbow, rWrist);
  const avgAngle = (leftAngle + rightAngle) / 2;
  const depthThreshold = PUSH_UP_BOTTOM_ANGLE + calibrationOffset;

  if (phase === 'up' && avgAngle < depthThreshold) {
    return { newPhase: 'down', repCounted: false, validRep: false, elbowAngle: avgAngle, shoulderAngle: avgAngle };
  }
  if (phase === 'down' && avgAngle > PUSH_UP_ELBOW_LOCKOUT_ANGLE) {
    return { newPhase: 'up', repCounted: true, validRep: true, elbowAngle: avgAngle, shoulderAngle: avgAngle };
  }
  return { newPhase: phase, repCounted: false, validRep: avgAngle < depthThreshold, elbowAngle: avgAngle, shoulderAngle: avgAngle };
}

export function analyzeSquat(
  pose: Pose,
  phase: RepPhase,
  calibrationOffset = 0
): RepAnalysisResult {
  const lHip = getKeypoint(pose, 'left_hip');
  const lKnee = getKeypoint(pose, 'left_knee');
  const lAnkle = getKeypoint(pose, 'left_ankle');
  const rHip = getKeypoint(pose, 'right_hip');
  const rKnee = getKeypoint(pose, 'right_knee');
  const rAnkle = getKeypoint(pose, 'right_ankle');

  if (!lHip || !lKnee || !lAnkle || !rHip || !rKnee || !rAnkle) {
    return { newPhase: phase, repCounted: false, validRep: false, elbowAngle: 0, shoulderAngle: 0 };
  }

  const leftAngle = getAngle(lHip, lKnee, lAnkle);
  const rightAngle = getAngle(rHip, rKnee, rAnkle);
  const avgAngle = (leftAngle + rightAngle) / 2;
  const depthThreshold = SQUAT_BOTTOM_ANGLE + calibrationOffset;

  if (phase === 'up' && avgAngle < depthThreshold) {
    return { newPhase: 'down', repCounted: false, validRep: false, elbowAngle: avgAngle, shoulderAngle: avgAngle };
  }
  if (phase === 'down' && avgAngle > 120) {
    return { newPhase: 'up', repCounted: true, validRep: true, elbowAngle: avgAngle, shoulderAngle: avgAngle };
  }
  return { newPhase: phase, repCounted: false, validRep: avgAngle < depthThreshold, elbowAngle: avgAngle, shoulderAngle: avgAngle };
}

export function analyzeRep(
  pose: Pose,
  exerciseType: ExerciseType,
  phase: RepPhase,
  calibrationOffset = 0
): RepAnalysisResult {
  if (exerciseType === 'push_ups') return analyzePushUp(pose, phase, calibrationOffset);
  return analyzeSquat(pose, phase, calibrationOffset);
}
