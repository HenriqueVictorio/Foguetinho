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
    this.crashAt = null;
    this.mode = 'auto'; // 'auto' | 'manual'
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

  setMode(mode) {
    if (mode !== 'auto' && mode !== 'manual') return;
    this.mode = mode;
    // Em modo manual, evite auto-crash da rodada atual
    if (this.mode === 'manual') {
      this.crashAt = Number.POSITIVE_INFINITY;
    }
  }

  forceCrash() {
    if (!this.currentRoundId) return;
    if (this.timer) clearInterval(this.timer);
    const finalMultiplier = Math.max(1, Math.round(this.currentMultiplier * 100) / 100);
    const endTime = new Date().toISOString();
    endRound({ id: this.currentRoundId, end_time: endTime, crash_multiplier: finalMultiplier });
    this.onRoundEnd?.({ roundId: this.currentRoundId, endTime, crashAt: finalMultiplier });
    // inicia próxima rodada logo depois
    setTimeout(() => this._startNewRound(), 1000);
  }

  _startNewRound() {
    this.currentMultiplier = 1.0;
    this.currentRoundId = uuidv4();
    const startTime = new Date().toISOString();
    createRound({ id: this.currentRoundId, start_time: startTime });
    this.crashAt = this.mode === 'manual' ? Number.POSITIVE_INFINITY : this._sampleCrashMultiplier();

    this.onRoundStart?.({ roundId: this.currentRoundId, startTime, crashAt: this.crashAt });

    const start = Date.now();
    this.timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const base = 1 + (elapsed / this.roundDurationMs) * (this.crashAt === Number.POSITIVE_INFINITY ? 10 : this.crashAt);
      this.currentMultiplier = Math.max(1, Math.floor((base) * 100) / 100);

      const shouldEndByTime = this.mode === 'auto' && elapsed >= this.roundDurationMs;
      const shouldEndByCrash = this.mode === 'auto' && this.currentMultiplier >= this.crashAt;
      if (shouldEndByTime || shouldEndByCrash) {
        const finalMultiplier = Math.min(this.currentMultiplier, this.crashAt);
        clearInterval(this.timer);
        const endTime = new Date().toISOString();
        endRound({ id: this.currentRoundId, end_time: endTime, crash_multiplier: finalMultiplier });
        const nextDelay = 10000; // 10s pausa entre rodadas
        const nextStartAt = Date.now() + nextDelay;
        this.onRoundEnd?.({ roundId: this.currentRoundId, endTime, crashAt: finalMultiplier, nextStartAt });
        setTimeout(() => this._startNewRound(), nextDelay);
      } else {
        this.onTick?.({ roundId: this.currentRoundId, multiplier: this.currentMultiplier, crashAt: this.crashAt });
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
