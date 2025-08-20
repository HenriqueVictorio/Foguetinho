import { v4 as uuidv4 } from 'uuid';
import { createRound, endRound } from './db.js';

export class CrashGame {
  constructor({ tickMs = 100, roundDurationMs = 10000, onTick, onRoundStart, onRoundEnd }) {
    this.tickMs = tickMs;
    this.roundDurationMs = roundDurationMs;
    this.onTick = onTick;
    this.onRoundStart = onRoundStart;
    this.onRoundEnd = onRoundEnd;
    this.currentMultiplier = 1.0;
    this.currentRoundId = null;
    this.timer = null;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._startNewRound();
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
  }

  _startNewRound() {
    this.currentMultiplier = 1.0;
    this.currentRoundId = uuidv4();
    const startTime = new Date().toISOString();
    createRound({ id: this.currentRoundId, start_time: startTime });
    const crashAt = this._sampleCrashMultiplier();

    this.onRoundStart?.({ roundId: this.currentRoundId, startTime, crashAt });

    const start = Date.now();
    this.timer = setInterval(() => {
      const elapsed = Date.now() - start;
      this.currentMultiplier = Math.max(1, Math.floor((1 + elapsed / this.roundDurationMs * crashAt) * 100) / 100);

      if (elapsed >= this.roundDurationMs || this.currentMultiplier >= crashAt) {
        const finalMultiplier = Math.min(this.currentMultiplier, crashAt);
        clearInterval(this.timer);
        const endTime = new Date().toISOString();
        endRound({ id: this.currentRoundId, end_time: endTime, crash_multiplier: finalMultiplier });
        this.onRoundEnd?.({ roundId: this.currentRoundId, endTime, crashAt: finalMultiplier });
        setTimeout(() => this._startNewRound(), 1000);
      } else {
        this.onTick?.({ roundId: this.currentRoundId, multiplier: this.currentMultiplier, crashAt });
      }
    }, this.tickMs);
  }

  _sampleCrashMultiplier() {
    // Exponential-like distribution: most small, some large
    const r = Math.random();
    const max = 10; // cap for prototype
    const mult = 1 + (-Math.log(1 - r)) * 1.5; // lambda=1.5
    return Math.min(max, Math.max(1.01, Math.round(mult * 100) / 100));
  }
}
