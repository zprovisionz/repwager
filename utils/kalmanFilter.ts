/**
 * 1D Kalman Filter for temporal smoothing
 * Reduces jitter in angle measurements from frame-to-frame pose detection
 *
 * Usage:
 *   const filter = new KalmanFilter(0.1, 0.1);  // q=process noise, r=measurement noise
 *   const smoothedValue = filter.update(measuredValue);
 */

export class KalmanFilter {
  private estimate: number;
  private errorEstimate: number;
  private q: number; // Process noise covariance
  private r: number; // Measurement noise covariance

  constructor(q: number = 0.01, r: number = 0.1, initialEstimate: number = 0) {
    this.q = q; // How much we trust the model (lower = trust more)
    this.r = r; // How much we trust measurements (lower = trust more)
    this.estimate = initialEstimate;
    this.errorEstimate = 1.0;
  }

  /**
   * Update filter with a new measurement
   * @param measurement The measured value (e.g., angle from pose detection)
   * @returns Smoothed estimate
   */
  update(measurement: number): number {
    // Prediction step
    const priorEstimate = this.estimate;
    const priorError = this.errorEstimate + this.q;

    // Update step
    const kalmanGain = priorError / (priorError + this.r);
    this.estimate = priorEstimate + kalmanGain * (measurement - priorEstimate);
    this.errorEstimate = (1 - kalmanGain) * priorError;

    return this.estimate;
  }

  /**
   * Reset filter to initial state
   */
  reset(initialEstimate: number = 0): void {
    this.estimate = initialEstimate;
    this.errorEstimate = 1.0;
  }

  /**
   * Get current estimate without updating
   */
  getEstimate(): number {
    return this.estimate;
  }
}

/**
 * Multi-dimensional Kalman Filter for 2D points (x, y)
 * Useful for smoothing keypoint positions
 */
export class KalmanFilter2D {
  private xFilter: KalmanFilter;
  private yFilter: KalmanFilter;

  constructor(q: number = 0.01, r: number = 0.1) {
    this.xFilter = new KalmanFilter(q, r);
    this.yFilter = new KalmanFilter(q, r);
  }

  /**
   * Update filter with a new 2D measurement
   * @param x X coordinate
   * @param y Y coordinate
   * @returns Smoothed {x, y} point
   */
  update(x: number, y: number): { x: number; y: number } {
    return {
      x: this.xFilter.update(x),
      y: this.yFilter.update(y),
    };
  }

  /**
   * Reset filter
   */
  reset(): void {
    this.xFilter.reset();
    this.yFilter.reset();
  }
}
