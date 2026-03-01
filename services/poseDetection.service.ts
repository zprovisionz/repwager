/*
  Pose Detection Service

  Pure geometry helpers — no external ML dependencies.
  Frame analysis is wired up via the usePoseDetection hook which can
  accept poses from any source (MoveNet CDN bundle on web, manual tap on native).
*/

import {
  PUSH_UP_ELBOW_LOCKOUT_ANGLE,
  PUSH_UP_BOTTOM_ANGLE,
  SQUAT_BOTTOM_ANGLE,
  SQUAT_LOCKOUT_ANGLE,
} from '@/lib/config';

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
): { newPhase: RepPhase; repCounted: boolean } {
  const lShoulder = getKeypoint(pose, 'left_shoulder');
  const lElbow = getKeypoint(pose, 'left_elbow');
  const lWrist = getKeypoint(pose, 'left_wrist');
  const rShoulder = getKeypoint(pose, 'right_shoulder');
  const rElbow = getKeypoint(pose, 'right_elbow');
  const rWrist = getKeypoint(pose, 'right_wrist');

  if (!lShoulder || !lElbow || !lWrist || !rShoulder || !rElbow || !rWrist) {
    return { newPhase: phase, repCounted: false };
  }

  const leftAngle = getAngle(lShoulder, lElbow, lWrist);
  const rightAngle = getAngle(rShoulder, rElbow, rWrist);
  const avgAngle = (leftAngle + rightAngle) / 2;

  if (phase === 'up' && avgAngle < PUSH_UP_BOTTOM_ANGLE) {
    return { newPhase: 'down', repCounted: false };
  }
  if (phase === 'down' && avgAngle > PUSH_UP_ELBOW_LOCKOUT_ANGLE) {
    return { newPhase: 'up', repCounted: true };
  }
  return { newPhase: phase, repCounted: false };
}

export function analyzeSquat(
  pose: Pose,
  phase: RepPhase
): { newPhase: RepPhase; repCounted: boolean } {
  const lHip = getKeypoint(pose, 'left_hip');
  const lKnee = getKeypoint(pose, 'left_knee');
  const lAnkle = getKeypoint(pose, 'left_ankle');
  const rHip = getKeypoint(pose, 'right_hip');
  const rKnee = getKeypoint(pose, 'right_knee');
  const rAnkle = getKeypoint(pose, 'right_ankle');

  if (!lHip || !lKnee || !lAnkle || !rHip || !rKnee || !rAnkle) {
    return { newPhase: phase, repCounted: false };
  }

  const leftAngle = getAngle(lHip, lKnee, lAnkle);
  const rightAngle = getAngle(rHip, rKnee, rAnkle);
  const avgAngle = (leftAngle + rightAngle) / 2;

  if (phase === 'up' && avgAngle < SQUAT_BOTTOM_ANGLE) {
    return { newPhase: 'down', repCounted: false };
  }
  if (phase === 'down' && avgAngle > SQUAT_LOCKOUT_ANGLE) {
    return { newPhase: 'up', repCounted: true };
  }
  return { newPhase: phase, repCounted: false };
}

export function analyzeRep(
  pose: Pose,
  exerciseType: ExerciseType,
  phase: RepPhase
): { newPhase: RepPhase; repCounted: boolean } {
  if (exerciseType === 'push_ups') return analyzePushUp(pose, phase);
  return analyzeSquat(pose, phase);
}
