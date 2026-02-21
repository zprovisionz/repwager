/**
 * Analytics Service
 * Logs rep attempts, form quality, and generates insights
 */

export interface RepAttempt {
  timestamp: number;
  repNumber: number;
  formQuality: number; // 0-100
  formIssues: string[];
  exerciseType: 'push_ups' | 'squats';
  velocitySeconds?: number;
}

export interface MatchAnalytics {
  matchId: string;
  userId: string;
  exerciseType: 'push_ups' | 'squats';
  totalReps: number;
  totalAttempts: number;
  validReps: number;
  invalidReps: number;
  averageQuality: number;
  formIssueFrequency: Record<string, number>;
  velocityAnomalies: number;
  startTime: number;
  endTime: number;
}

class AnalyticsService {
  private repLog: RepAttempt[] = [];
  private sessionStartTime: number = 0;

  /**
   * Initialize analytics for a new session
   */
  startSession(exerciseType: 'push_ups' | 'squats'): void {
    this.repLog = [];
    this.sessionStartTime = Date.now();
  }

  /**
   * Log a single rep attempt
   */
  logRepAttempt(
    repNumber: number,
    formQuality: number,
    formIssues: string[],
    exerciseType: 'push_ups' | 'squats',
    velocitySeconds?: number
  ): void {
    this.repLog.push({
      timestamp: Date.now(),
      repNumber,
      formQuality,
      formIssues,
      exerciseType,
      velocitySeconds,
    });
  }

  /**
   * Get all logged reps
   */
  getReps(): RepAttempt[] {
    return [...this.repLog];
  }

  /**
   * Get form issue frequency analysis
   */
  getFormIssueFrequency(): Record<string, number> {
    const frequency: Record<string, number> = {};

    for (const rep of this.repLog) {
      for (const issue of rep.formIssues) {
        frequency[issue] = (frequency[issue] || 0) + 1;
      }
    }

    return frequency;
  }

  /**
   * Get average form quality
   */
  getAverageQuality(): number {
    if (this.repLog.length === 0) return 0;
    const total = this.repLog.reduce((sum, rep) => sum + rep.formQuality, 0);
    return total / this.repLog.length;
  }

  /**
   * Get most common form issue
   */
  getMostCommonIssue(): string | null {
    const frequency = this.getFormIssueFrequency();
    const issues = Object.entries(frequency);

    if (issues.length === 0) return null;

    // Sort by frequency descending
    issues.sort(([, freqA], [, freqB]) => freqB - freqA);
    return issues[0][0];
  }

  /**
   * Get velocity anomalies count
   */
  getVelocityAnomalies(): number {
    return this.repLog.filter((rep) => rep.velocitySeconds && (rep.velocitySeconds < 0.5 || rep.velocitySeconds > 2.0)).length;
  }

  /**
   * Generate full analytics summary for a match
   */
  generateMatchAnalytics(matchId: string, userId: string): MatchAnalytics {
    const validReps = this.repLog.filter((rep) => rep.formQuality >= 75).length;
    const invalidReps = this.repLog.length - validReps;

    return {
      matchId,
      userId,
      exerciseType: this.repLog[0]?.exerciseType || 'push_ups',
      totalReps: validReps,
      totalAttempts: this.repLog.length,
      validReps,
      invalidReps,
      averageQuality: this.getAverageQuality(),
      formIssueFrequency: this.getFormIssueFrequency(),
      velocityAnomalies: this.getVelocityAnomalies(),
      startTime: this.sessionStartTime,
      endTime: Date.now(),
    };
  }

  /**
   * Generate form feedback for improvement
   */
  generateFeedback(): string[] {
    const mostCommon = this.getMostCommonIssue();
    const avgQuality = this.getAverageQuality();
    const feedback: string[] = [];

    if (avgQuality < 75) {
      feedback.push('Your form quality is below competitive standard. Focus on proper technique.');
    } else if (avgQuality < 85) {
      feedback.push('Good effort! Work on form consistency to improve your quality score.');
    } else {
      feedback.push('Excellent form! Keep up the great technique.');
    }

    if (mostCommon) {
      feedback.push(`Most common issue: ${mostCommon.toLowerCase()}`);
    }

    const velocityAnomalies = this.getVelocityAnomalies();
    if (velocityAnomalies > this.repLog.length * 0.2) {
      feedback.push('Control your rep pace - avoid bouncing or stalling.');
    }

    return feedback;
  }

  /**
   * Clear all logged data
   */
  clear(): void {
    this.repLog = [];
    this.sessionStartTime = 0;
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
