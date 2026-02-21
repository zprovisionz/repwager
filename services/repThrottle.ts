import { REP_DEBOUNCE_MS } from '@/lib/config';

export class RepThrottle {
  private lastRepTime = 0;

  canCount(): boolean {
    const now = Date.now();
    const elapsed = now - this.lastRepTime;
    if (elapsed >= REP_DEBOUNCE_MS) {
      this.lastRepTime = now;
      console.log('[RepThrottle] canCount: true — elapsed:', elapsed, 'ms');
      return true;
    }
    console.log('[RepThrottle] canCount: false — throttled, only', elapsed, 'ms since last rep (need', REP_DEBOUNCE_MS, 'ms)');
    return false;
  }

  reset() {
    this.lastRepTime = 0;
  }
}
