import { REP_DEBOUNCE_MS, FORM_QUALITY_MIN_THRESHOLD, DEV_MODE_ENABLED } from '@/lib/config';

export interface RepQualityScore {
  formQuality: number; // 0-100
  isValid: boolean; // >= FORM_QUALITY_MIN_THRESHOLD
  issues: string[];
}

export class RepThrottle {
  private lastRepTime = 0;
  private lastRepQualities: RepQualityScore[] = [];
  private consecutiveLowQualityReps = 0;

  canCount(): boolean {
    const now = Date.now();
    const elapsed = now - this.lastRepTime;
    if (elapsed >= REP_DEBOUNCE_MS) {
      this.lastRepTime = now;
      if (DEV_MODE_ENABLED) console.log('[RepThrottle] canCount: true — elapsed:', elapsed, 'ms');
      return true;
    }
    if (DEV_MODE_ENABLED) console.log('[RepThrottle] canCount: false — throttled, only', elapsed, 'ms since last rep (need', REP_DEBOUNCE_MS, 'ms)');
    return false;
  }

  /**
   * Check if rep should be counted based on form quality
   * @param quality - Form quality score (0-100)
   * @returns Whether rep meets minimum quality threshold
   */
  isQualityAcceptable(quality: number): boolean {
    const isAcceptable = quality >= FORM_QUALITY_MIN_THRESHOLD;

    if (!isAcceptable) {
      this.consecutiveLowQualityReps++;
      if (DEV_MODE_ENABLED) console.log('[RepThrottle] Low form quality:', quality, '% — consecutive low-quality reps:', this.consecutiveLowQualityReps);
    } else {
      this.consecutiveLowQualityReps = 0;
    }

    return isAcceptable;
  }

  /**
   * Track rep quality for analytics
   */
  recordQualityScore(score: RepQualityScore): void {
    this.lastRepQualities.push(score);
    // Keep only last 10 reps in memory
    if (this.lastRepQualities.length > 10) {
      this.lastRepQualities.shift();
    }
  }

  /**
   * Get average form quality over last N reps
   */
  getAverageQuality(lastN: number = 5): number {
    const recentReps = this.lastRepQualities.slice(-lastN);
    if (recentReps.length === 0) return 100;

    const total = recentReps.reduce((sum, score) => sum + score.formQuality, 0);
    return total / recentReps.length;
  }

  /**
   * Check if user should be warned about poor form
   */
  shouldWarnAboutForm(): boolean {
    return this.consecutiveLowQualityReps >= 2;
  }

  /**
   * Get warning message for poor form
   */
  getFormWarning(): string | null {
    if (this.consecutiveLowQualityReps === 0) return null;

    const lastQuality = this.lastRepQualities[this.lastRepQualities.length - 1];
    if (!lastQuality || !lastQuality.issues.length) return null;

    return `Poor form: ${lastQuality.issues[0]}`;
  }

  /**
   * Reset throttle and quality tracking
   */
  reset() {
    this.lastRepTime = 0;
    this.lastRepQualities = [];
    this.consecutiveLowQualityReps = 0;
  }
}
