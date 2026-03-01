/**
 * Pose Detection Benchmarks
 *
 * Ground-truth test datasets for validating pose detection accuracy.
 * Each benchmark includes:
 * - Known exercise type and rep count
 * - Synthetic or recorded pose sequences
 * - Expected form quality metrics
 * - Difficulty level
 */

import type { Pose } from '@/services/poseDetection.service';

export interface Benchmark {
  id: string;
  name: string;
  description: string;
  exercise: 'push_ups' | 'squats';
  expectedReps: number;
  expectedFormQuality: number;
  difficulty: 'easy' | 'medium' | 'hard';
  poses: Pose[];
  notes: string;
}

/**
 * Generate synthetic push-up pose sequence
 * @param reps Number of reps to generate
 * @param quality Form quality (0-100) affects angle consistency
 */
export function generatePushUpSequence(reps: number, quality: number = 90): Pose[] {
  const poses: Pose[] = [];
  const framesPerRep = 60; // 2 seconds at 30fps
  const upDuration = framesPerRep / 2;
  const downDuration = framesPerRep / 2;

  for (let rep = 0; rep < reps; rep++) {
    // DOWN PHASE: Elbow angle from 160° (lockout) to 85° (bottom)
    for (let frame = 0; frame < downDuration; frame++) {
      const progress = frame / downDuration;
      // Add noise based on quality
      const noise = (100 - quality) * 0.5 * (Math.random() - 0.5);
      const elbowAngle = 160 - (160 - 85) * progress + noise;

      poses.push(generatePushUpPose(elbowAngle));
    }

    // UP PHASE: Elbow angle from 85° to 160°
    for (let frame = 0; frame < upDuration; frame++) {
      const progress = frame / upDuration;
      const noise = (100 - quality) * 0.5 * (Math.random() - 0.5);
      const elbowAngle = 85 + (160 - 85) * progress + noise;

      poses.push(generatePushUpPose(elbowAngle));
    }
  }

  return poses;
}

/**
 * Generate a single push-up pose with given elbow angle
 */
function generatePushUpPose(elbowAngle: number): Pose {
  // Simplified pose with left/right arms
  const baseX = 250;
  const baseY = 200;
  const shoulderWidth = 80;
  const armLength = 100;

  // Calculate elbow position based on angle
  const elbowRadians = ((180 - elbowAngle) * Math.PI) / 180;
  const elbowOffsetX = Math.cos(elbowRadians) * armLength;
  const elbowOffsetY = Math.sin(elbowRadians) * armLength * 0.5;

  return {
    keypoints: [
      // Left arm
      { name: 'left_shoulder', x: baseX - shoulderWidth / 2, y: baseY, score: 0.95 },
      { name: 'left_elbow', x: baseX - shoulderWidth / 2 + elbowOffsetX, y: baseY + elbowOffsetY, score: 0.92 },
      { name: 'left_wrist', x: baseX - shoulderWidth / 2 + elbowOffsetX * 1.8, y: baseY + elbowOffsetY * 1.8, score: 0.88 },

      // Right arm (mirror)
      { name: 'right_shoulder', x: baseX + shoulderWidth / 2, y: baseY, score: 0.95 },
      { name: 'right_elbow', x: baseX + shoulderWidth / 2 - elbowOffsetX, y: baseY + elbowOffsetY, score: 0.92 },
      { name: 'right_wrist', x: baseX + shoulderWidth / 2 - elbowOffsetX * 1.8, y: baseY + elbowOffsetY * 1.8, score: 0.88 },

      // Body (for alignment check)
      { name: 'left_hip', x: baseX - 40, y: baseY + 120, score: 0.85 },
      { name: 'right_hip', x: baseX + 40, y: baseY + 120, score: 0.85 },
      { name: 'left_knee', x: baseX - 40, y: baseY + 200, score: 0.80 },
      { name: 'right_knee', x: baseX + 40, y: baseY + 200, score: 0.80 },
    ],
  };
}

/**
 * Generate synthetic squat pose sequence
 * @param reps Number of reps to generate
 * @param quality Form quality (0-100)
 */
export function generateSquatSequence(reps: number, quality: number = 90): Pose[] {
  const poses: Pose[] = [];
  const framesPerRep = 60; // 2 seconds at 30fps
  const downDuration = framesPerRep / 2;
  const upDuration = framesPerRep / 2;

  for (let rep = 0; rep < reps; rep++) {
    // DOWN PHASE: Knee angle from 160° to 85°
    for (let frame = 0; frame < downDuration; frame++) {
      const progress = frame / downDuration;
      const noise = (100 - quality) * 0.5 * (Math.random() - 0.5);
      const kneeAngle = 160 - (160 - 85) * progress + noise;

      poses.push(generateSquatPose(kneeAngle));
    }

    // UP PHASE: Knee angle from 85° to 160°
    for (let frame = 0; frame < upDuration; frame++) {
      const progress = frame / upDuration;
      const noise = (100 - quality) * 0.5 * (Math.random() - 0.5);
      const kneeAngle = 85 + (160 - 85) * progress + noise;

      poses.push(generateSquatPose(kneeAngle));
    }
  }

  return poses;
}

/**
 * Generate a single squat pose with given knee angle
 */
function generateSquatPose(kneeAngle: number): Pose {
  const centerX = 250;
  const centerY = 200;
  const hipHeight = 0;
  const kneeLength = 120;
  const ankleLength = 110;

  // Calculate knee position
  const kneeRadians = ((180 - kneeAngle) * Math.PI) / 180;
  const kneeY = hipHeight + Math.sin(kneeRadians) * kneeLength;
  const kneeX = centerX + Math.cos(kneeRadians) * kneeLength;

  // Calculate ankle position
  const ankleRadians = kneeRadians - ((180 - 90) * Math.PI) / 180;
  const ankleY = kneeY + Math.sin(ankleRadians) * ankleLength;
  const ankleX = kneeX + Math.cos(ankleRadians) * ankleLength;

  return {
    keypoints: [
      // Left leg
      { name: 'left_hip', x: centerX - 40, y: hipHeight, score: 0.95 },
      { name: 'left_knee', x: kneeX - 40, y: kneeY, score: 0.92 },
      { name: 'left_ankle', x: ankleX - 40, y: ankleY, score: 0.88 },

      // Right leg
      { name: 'right_hip', x: centerX + 40, y: hipHeight, score: 0.95 },
      { name: 'right_knee', x: kneeX + 40, y: kneeY, score: 0.92 },
      { name: 'right_ankle', x: ankleX + 40, y: ankleY, score: 0.88 },

      // Upper body (for torso lean check)
      { name: 'left_shoulder', x: centerX - 50, y: hipHeight - 100, score: 0.90 },
      { name: 'right_shoulder', x: centerX + 50, y: hipHeight - 100, score: 0.90 },
    ],
  };
}

/**
 * Predefined benchmark suite
 */
export const BENCHMARK_SUITE: Benchmark[] = [
  {
    id: 'pushup_10_good',
    name: '10 Push-ups - Good Form',
    description: 'Clean push-ups with consistent form and full range of motion',
    exercise: 'push_ups',
    expectedReps: 10,
    expectedFormQuality: 92,
    difficulty: 'easy',
    poses: generatePushUpSequence(10, 95),
    notes: 'Baseline: excellent form, full lockout, proper depth',
  },

  {
    id: 'pushup_10_fair',
    name: '10 Push-ups - Fair Form',
    description: 'Push-ups with occasional form breaks, incomplete lockouts',
    exercise: 'push_ups',
    expectedReps: 10,
    expectedFormQuality: 75,
    difficulty: 'medium',
    poses: generatePushUpSequence(10, 75),
    notes: 'Partial range of motion, some form deviations, 2-3 incomplete reps',
  },

  {
    id: 'pushup_10_poor',
    name: '10 Push-ups - Poor Form',
    description: 'Push-ups with significant form breaks, limited depth',
    exercise: 'push_ups',
    expectedReps: 10,
    expectedFormQuality: 55,
    difficulty: 'hard',
    poses: generatePushUpSequence(10, 55),
    notes: 'Half-reps, incomplete lockouts, body alignment issues',
  },

  {
    id: 'squat_15_good',
    name: '15 Squats - Good Form',
    description: 'Clean squats with proper depth and alignment',
    exercise: 'squats',
    expectedReps: 15,
    expectedFormQuality: 90,
    difficulty: 'easy',
    poses: generateSquatSequence(15, 95),
    notes: 'Full depth, proper lockout, consistent form',
  },

  {
    id: 'squat_15_fair',
    name: '15 Squats - Fair Form',
    description: 'Squats with occasional depth issues',
    exercise: 'squats',
    expectedReps: 15,
    expectedFormQuality: 72,
    difficulty: 'medium',
    poses: generateSquatSequence(15, 75),
    notes: '2-3 quarter reps, slight knee cave, minor form breaks',
  },

  {
    id: 'squat_20_challenging',
    name: '20 Squats - Challenging Set',
    description: 'High-rep squat set with fatigue-related form degradation',
    exercise: 'squats',
    expectedReps: 20,
    expectedFormQuality: 68,
    difficulty: 'hard',
    poses: generateSquatSequence(20, 60),
    notes: 'Progressive form breakdown in final reps, depth inconsistency',
  },
];

/**
 * Find benchmark by ID
 */
export function getBenchmark(id: string): Benchmark | undefined {
  return BENCHMARK_SUITE.find(b => b.id === id);
}

/**
 * Get all benchmarks for an exercise
 */
export function getBenchmarksByExercise(exercise: 'push_ups' | 'squats'): Benchmark[] {
  return BENCHMARK_SUITE.filter(b => b.exercise === exercise);
}

/**
 * Get benchmarks by difficulty
 */
export function getBenchmarksByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): Benchmark[] {
  return BENCHMARK_SUITE.filter(b => b.difficulty === difficulty);
}
