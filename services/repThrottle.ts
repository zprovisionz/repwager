import { REP_DEBOUNCE_MS } from '@/lib/config';

export class RepThrottle {
  private lastRepTime = 0;

  canCount(): boolean {
    const now = Date.now();
    const elapsed = now - this.lastRepTime;
    if (elapsed >= REP_DEBOUNCE_MS) {
      this.lastRepTime = now;
      return true;
    }
    return false;
  }

  reset() {
    this.lastRepTime = 0;
  }
}
