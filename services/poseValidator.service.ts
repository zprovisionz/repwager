/**
 * Pose Detection Validator Service
 *
 * Benchmarking system to validate pose detection accuracy against known rep counts.
 * Provides detailed metrics for tuning thresholds to achieve 95%+ accuracy.
 *
 * Usage:
 *   const validator = new PoseValidator();
 *   const result = await validator.validateVideoWithGroundTruth(videoPath, {
 *     exercise: 'push_ups',
 *     expectedReps: 10,
 *     expectedFormQuality: 85
 *   });
 */

import { analyzePushUp, analyzeSquat, type ExerciseType, type RepPhase, type Pose } from '@/services/poseDetection.service';

export interface ValidationConfig {
  exercise: ExerciseType;
  expectedReps: number;
  expectedFormQuality?: number;
  confidenceThreshold?: number;
  hysteresisAngle?: number;
  verbose?: boolean;
}

export interface DetectionResult {
  frameNumber: number;
  timestamp: number;
  angle: number;
  phase: RepPhase;
  repCounted: boolean;
  formQuality?: number;
  formIssues?: string[];
}

export interface ValidationMetrics {
  totalFrames: number;
  totalRepsDetected: number;
  expectedReps: number;
  repAccuracy: number; // percentage
  repDifference: number; // detected - expected
  falsePositives: number;
  falseNegatives: number;
  averageFormQuality: number;
  confidenceDistribution: {
    veryLow: number; // 0-0.3
    low: number;    // 0.3-0.6
    medium: number; // 0.6-0.8
    high: number;   // 0.8+
  };
  temporalConsistency: number; // measure of phase stability
  recommendations: string[];
}

export class PoseValidator {
  private detectionResults: DetectionResult[] = [];
  private currentPhase: RepPhase = 'up';
  private repCount = 0;
  private frameNumber = 0;
  private lastAngle = 0;

  /**
   * Validate pose detection against known ground truth
   */
  async validateVideoWithGroundTruth(
    poses: Pose[],
    config: ValidationConfig
  ): Promise<{ metrics: ValidationMetrics; results: DetectionResult[] }> {
    this.reset();
    this.detectionResults = [];

    // Process each frame
    poses.forEach((pose, index) => {
      const result = this.processFrame(pose, config.exercise, index);
      this.detectionResults.push(result);
    });

    // Calculate metrics
    const metrics = this.calculateMetrics(config);

    if (config.verbose) {
      this.printDetailedAnalysis(metrics);
    }

    return { metrics, results: this.detectionResults };
  }

  /**
   * Process a single frame and return detection result
   */
  private processFrame(
    pose: Pose,
    exercise: ExerciseType,
    frameNumber: number
  ): DetectionResult {
    this.frameNumber = frameNumber;

    // Run appropriate exercise detector
    const analysis = exercise === 'push_ups'
      ? analyzePushUp(pose, this.currentPhase)
      : analyzeSquat(pose, this.currentPhase);

    // Update phase
    this.currentPhase = analysis.newPhase;

    // Count rep if detected
    if (analysis.repCounted) {
      this.repCount++;
    }

    // Extract angle for temporal analysis (simplified)
    const avgAngle = this.extractAverageAngle(pose, exercise);

    return {
      frameNumber,
      timestamp: frameNumber * (1000 / 30), // assume 30 FPS
      angle: avgAngle,
      phase: this.currentPhase,
      repCounted: analysis.repCounted,
      formQuality: analysis.formQuality,
      formIssues: analysis.formIssues,
    };
  }

  /**
   * Extract average angle from pose for temporal analysis
   */
  private extractAverageAngle(pose: Pose, exercise: ExerciseType): number {
    // Get keypoints
    const keypoints = pose.keypoints;
    if (keypoints.length < 6) return 0;

    if (exercise === 'push_ups') {
      // Left + right elbow angles
      const lElbow = keypoints.find(k => k.name === 'left_elbow');
      const rElbow = keypoints.find(k => k.name === 'right_elbow');
      const lWrist = keypoints.find(k => k.name === 'left_wrist');
      const rWrist = keypoints.find(k => k.name === 'right_wrist');
      const lShoulder = keypoints.find(k => k.name === 'left_shoulder');
      const rShoulder = keypoints.find(k => k.name === 'right_shoulder');

      if (!lElbow || !rElbow || !lWrist || !rWrist || !lShoulder || !rShoulder) return 0;

      const leftAngle = this.getAngle(lShoulder, lElbow, lWrist);
      const rightAngle = this.getAngle(rShoulder, rElbow, rWrist);
      return (leftAngle + rightAngle) / 2;
    } else {
      // Squat: knee angles
      const lKnee = keypoints.find(k => k.name === 'left_knee');
      const rKnee = keypoints.find(k => k.name === 'right_knee');
      const lAnkle = keypoints.find(k => k.name === 'left_ankle');
      const rAnkle = keypoints.find(k => k.name === 'right_ankle');
      const lHip = keypoints.find(k => k.name === 'left_hip');
      const rHip = keypoints.find(k => k.name === 'right_hip');

      if (!lKnee || !rKnee || !lAnkle || !rAnkle || !lHip || !rHip) return 0;

      const leftAngle = this.getAngle(lHip, lKnee, lAnkle);
      const rightAngle = this.getAngle(rHip, rKnee, rAnkle);
      return (leftAngle + rightAngle) / 2;
    }
  }

  /**
   * Helper: calculate angle between 3 points
   */
  private getAngle(a: any, b: any, c: any): number {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return angle;
  }

  /**
   * Calculate comprehensive accuracy metrics
   */
  private calculateMetrics(config: ValidationConfig): ValidationMetrics {
    const repDifference = this.repCount - config.expectedReps;
    const repAccuracy = config.expectedReps > 0
      ? ((config.expectedReps - Math.abs(repDifference)) / config.expectedReps) * 100
      : 0;

    // Calculate confidence distribution
    const confidences = this.detectionResults
      .filter(r => r.formQuality !== undefined)
      .map(r => r.formQuality!);

    const confidenceDistribution = {
      veryLow: confidences.filter(c => c < 30).length,
      low: confidences.filter(c => c >= 30 && c < 60).length,
      medium: confidences.filter(c => c >= 60 && c < 80).length,
      high: confidences.filter(c => c >= 80).length,
    };

    // Calculate temporal consistency (how stable is phase detection?)
    const phaseChanges = this.countPhaseChanges();
    const expectedPhaseChanges = config.expectedReps * 2; // up->down->up per rep
    const temporalConsistency = expectedPhaseChanges > 0
      ? Math.min(100, (expectedPhaseChanges / Math.max(1, phaseChanges)) * 100)
      : 100;

    // Average form quality
    const averageFormQuality = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    // False positives/negatives
    const falsePositives = Math.max(0, this.repCount - config.expectedReps);
    const falseNegatives = Math.max(0, config.expectedReps - this.repCount);

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      repAccuracy,
      averageFormQuality,
      falsePositives,
      falseNegatives,
      temporalConsistency,
      detectionResults: this.detectionResults,
    });

    return {
      totalFrames: this.detectionResults.length,
      totalRepsDetected: this.repCount,
      expectedReps: config.expectedReps,
      repAccuracy: Math.round(repAccuracy * 100) / 100,
      repDifference,
      falsePositives,
      falseNegatives,
      averageFormQuality: Math.round(averageFormQuality * 100) / 100,
      confidenceDistribution,
      temporalConsistency: Math.round(temporalConsistency * 100) / 100,
      recommendations,
    };
  }

  /**
   * Count phase transitions to assess stability
   */
  private countPhaseChanges(): number {
    let changes = 0;
    for (let i = 1; i < this.detectionResults.length; i++) {
      if (this.detectionResults[i].phase !== this.detectionResults[i - 1].phase) {
        changes++;
      }
    }
    return changes;
  }

  /**
   * Generate tuning recommendations based on analysis
   */
  private generateRecommendations(analysis: any): string[] {
    const recs: string[] = [];

    if (analysis.repAccuracy < 85) {
      recs.push('⚠️ Rep accuracy below 85% — consider reducing hysteresis threshold');
    }

    if (analysis.falsePositives > 2) {
      recs.push(`⚠️ ${analysis.falsePositives} false positives detected — increase minimum angle threshold`);
    }

    if (analysis.falseNegatives > 2) {
      recs.push(`⚠️ ${analysis.falseNegatives} false negatives detected — lower angle thresholds or increase hysteresis`);
    }

    if (analysis.averageFormQuality < 70) {
      recs.push('⚠️ Form quality below 70% — check range-of-motion threshold');
    }

    if (analysis.temporalConsistency < 80) {
      recs.push('⚠️ High phase instability — increase hysteresis to prevent flapping');
    }

    if (recs.length === 0) {
      recs.push('✅ Detection parameters are well-tuned');
    }

    return recs;
  }

  /**
   * Reset validator state
   */
  private reset(): void {
    this.detectionResults = [];
    this.currentPhase = 'up';
    this.repCount = 0;
    this.frameNumber = 0;
    this.lastAngle = 0;
  }

  /**
   * Print detailed analysis for debugging
   */
  private printDetailedAnalysis(metrics: ValidationMetrics): void {
    console.log('\n=== POSE DETECTION VALIDATION REPORT ===\n');
    console.log(`📊 Rep Counting:
      Expected: ${metrics.expectedReps} reps
      Detected: ${metrics.totalRepsDetected} reps
      Accuracy: ${metrics.repAccuracy}%
      Difference: ${metrics.repDifference > 0 ? '+' : ''}${metrics.repDifference}`);

    console.log(`\n❌ False Detections:
      False Positives: ${metrics.falsePositives}
      False Negatives: ${metrics.falseNegatives}`);

    console.log(`\n✨ Form Quality:
      Average: ${metrics.averageFormQuality}%
      Distribution:
        Very Low (0-30%):   ${metrics.confidenceDistribution.veryLow}
        Low (30-60%):       ${metrics.confidenceDistribution.low}
        Medium (60-80%):    ${metrics.confidenceDistribution.medium}
        High (80%+):        ${metrics.confidenceDistribution.high}`);

    console.log(`\n⚡ Temporal Stability:
      Phase Consistency: ${metrics.temporalConsistency}%`);

    console.log(`\n📋 Recommendations:`);
    metrics.recommendations.forEach(rec => console.log(`  ${rec}`));
    console.log();
  }

  /**
   * Export metrics to JSON
   */
  exportJSON(metrics: ValidationMetrics): string {
    return JSON.stringify(metrics, null, 2);
  }

  /**
   * Export metrics to CSV (for batch testing)
   */
  exportCSV(metricsArray: ValidationMetrics[]): string {
    const headers = [
      'Exercise',
      'Expected Reps',
      'Detected Reps',
      'Rep Accuracy %',
      'False Positives',
      'False Negatives',
      'Form Quality %',
      'Temporal Consistency %',
    ];

    const rows = metricsArray.map(m => [
      m.expectedReps,
      m.totalRepsDetected,
      m.repAccuracy,
      m.falsePositives,
      m.falseNegatives,
      m.averageFormQuality,
      m.temporalConsistency,
    ]);

    return [
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n');
  }
}
