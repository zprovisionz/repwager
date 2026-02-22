/**
 * Pose Detection Service
 * Uses TensorFlow.js Pose Detection (compatible with Expo)
 * Detects 17 keypoints representing major body joints
 */

import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

// Type definitions for pose detection (must match poseDetection.service)
export interface Keypoint {
  name: string;
  x: number;
  y: number;
  score?: number;
}

export interface Pose {
  keypoints: Keypoint[];
}

// Type aliases for compatibility
type PoseDetectionPose = any; // Will be properly typed once dependencies are installed
type PoseDetector = any;

let detector: PoseDetector | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the pose detector model
 * Uses TensorFlow.js Pose Detection (compatible with Expo)
 * Note: In React Native/Expo, TensorFlow models can't be loaded due to fetch API limitations
 * Pose detection is disabled by default - users can count reps manually
 */
export async function initializePoseDetector(): Promise<void> {
  // Return cached promise if already initializing
  if (isInitializing && initPromise) {
    return initPromise;
  }

  if (detector) {
    return; // Already initialized
  }

  isInitializing = true;

  initPromise = (async () => {
    try {
      console.log('[PoseDetection] Pose detection is not available in this React Native environment');
      console.log('[PoseDetection] Users can count reps manually or on web');

      // Mark as initialized but with no actual detector
      // This prevents repeated initialization attempts
      detector = { type: 'disabled' } as any;
      isInitializing = false;
    } catch (error) {
      console.warn('[PoseDetection] Error during initialization setup:', error);
      isInitializing = false;
    }
  })();

  return initPromise;
}

/**
 * Detect poses from an image/canvas element
 * @param image - Image data (HTMLCanvasElement on web, or raw image data on native)
 * @returns Poses with keypoints and confidence scores
 * Note: Returns empty array in React Native since TensorFlow models require fetch API
 */
export async function detectPose(image: any): Promise<Pose[]> {
  if (!detector || detector.type === 'disabled') {
    // Pose detection not available in this environment
    return [];
  }

  try {
    const poses = await detector.estimatePoses(image, {
      maxPoses: 1, // Single person detection
      flipHorizontal: false,
    });

    return poses;
  } catch (error) {
    console.warn('[PoseDetection] Error detecting pose:', error);
    return [];
  }
}

/**
 * Get a specific keypoint from a pose by name
 * @param pose - Pose object with keypoints
 * @param keypointName - Name of the keypoint (e.g., 'left_shoulder', 'right_elbow')
 * @returns Keypoint with x, y, score or null if not found
 */
export function getKeypoint(pose: Pose, keypointName: string): Keypoint | null {
  if (!pose.keypoints) return null;

  const keypoint = pose.keypoints.find((kp) => kp.name === keypointName);
  return keypoint || null;
}

/**
 * Filter keypoints by confidence threshold
 * @param pose - Pose object
 * @param threshold - Minimum confidence score (0-1)
 * @returns Pose with filtered keypoints
 */
export function filterByConfidence(pose: Pose, threshold: number): Pose {
  if (!pose.keypoints) return pose;

  return {
    ...pose,
    keypoints: pose.keypoints.filter((kp: Keypoint) => (kp.score || 0) >= threshold),
  };
}

/**
 * Calculate the distance between two keypoints
 * @param kp1 - First keypoint
 * @param kp2 - Second keypoint
 * @returns Distance in pixels
 */
export function getDistance(kp1: Keypoint, kp2: Keypoint): number {
  const dx = kp1.x - kp2.x;
  const dy = kp1.y - kp2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate the angle at a joint given three keypoints
 * Angle is calculated at the middle point (vertex)
 * @param start - Starting point (e.g., shoulder)
 * @param vertex - Middle point (e.g., elbow)
 * @param end - Ending point (e.g., wrist)
 * @returns Angle in degrees (0-180)
 */
export function getJointAngle(start: Keypoint, vertex: Keypoint, end: Keypoint): number {
  // Vectors from vertex to start and vertex to end
  const vector1 = { x: start.x - vertex.x, y: start.y - vertex.y };
  const vector2 = { x: end.x - vertex.x, y: end.y - vertex.y };

  // Dot product and magnitudes
  const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y;
  const magnitude1 = Math.sqrt(vector1.x ** 2 + vector1.y ** 2);
  const magnitude2 = Math.sqrt(vector2.x ** 2 + vector2.y ** 2);

  // Avoid division by zero
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  // Calculate cosine of angle
  const cosAngle = dotProduct / (magnitude1 * magnitude2);
  // Clamp to avoid numerical errors
  const clampedCosAngle = Math.max(-1, Math.min(1, cosAngle));

  // Convert to degrees
  const angleRadians = Math.acos(clampedCosAngle);
  const angleDegrees = (angleRadians * 180) / Math.PI;

  return angleDegrees;
}

/**
 * Get average confidence for a set of keypoints
 * @param keypoints - Array of keypoints
 * @returns Average confidence score (0-1)
 */
export function getAverageConfidence(keypoints: Keypoint[]): number {
  if (keypoints.length === 0) return 0;

  const totalScore = keypoints.reduce((sum: number, kp: Keypoint) => sum + (kp.score || 0), 0);
  return totalScore / keypoints.length;
}

/**
 * Check if a keypoint has sufficient confidence
 * @param keypoint - Keypoint to check
 * @param threshold - Minimum confidence threshold (0-1)
 * @returns True if confidence >= threshold
 */
export function isConfident(keypoint: Keypoint | undefined, threshold: number): boolean {
  if (!keypoint) return false;
  return (keypoint.score || 0) >= threshold;
}

/**
 * Clean up and dispose of resources
 */
export async function disposePoseDetector(): Promise<void> {
  if (detector && detector.type !== 'disabled') {
    try {
      await detector.dispose();
    } catch (error) {
      // Silently ignore disposal errors
    }
  }
  detector = null;
  isInitializing = false;
  initPromise = null;
}
