export class Stopwatch {
  constructor(onTick, onAutoStop = () => {}, persist = null) {
    this.onTick = onTick;
    this.onAutoStop = onAutoStop;
    this.persist = persist;
    this.state = { status: 'idle', elapsedMs: 0, startedAt: null, task: '', sessionStartedAt: null };
    this.intervalId = null;
    this.MAX_TIME_MS = (99 * 3600 + 59 * 60 + 59) * 1000; // 99:59:59
  }

  start({ autoStopSeconds = 0 } = {}) {
    if (this.state.status === 'running') return;
    const now = Date.now();
    const autoStopMs = Math.max(0, autoStopSeconds) * 1000;
    this.state = { status: 'running', elapsedMs: this.state.elapsedMs, startedAt: now - this.state.elapsedMs, task: this.state.task, sessionStartedAt: this.state.sessionStartedAt || now, autoStopMs };
    this.#persistState();
    this.intervalId = window.setInterval(() => {
      this.state.elapsedMs = Date.now() - this.state.startedAt;
      
      // 达到最大时间限制
      if (this.state.elapsedMs >= this.MAX_TIME_MS) {
        this.state.elapsedMs = this.MAX_TIME_MS;
        this.stop();
        this.onAutoStop();
        return;
      }
      
      if (this.state.autoStopMs && this.state.elapsedMs >= this.state.autoStopMs) {
        this.state.elapsedMs = this.state.autoStopMs;
        this.stop();
        this.onAutoStop();
        return;
      }
      this.onTick(this.state);
    }, 10);
    this.onTick(this.state);
  }

  stop() {
    if (this.state.status !== 'running') return;
    window.clearInterval(this.intervalId);
    this.intervalId = null;
    this.state = { status: 'stopped', elapsedMs: this.state.elapsedMs, startedAt: null, task: this.state.task, sessionStartedAt: this.state.sessionStartedAt };
    this.#persistState();
    this.onTick(this.state);
  }

  complete(task) {
    if (this.state.status === 'idle') return null;
    const wasRunning = this.state.status === 'running';
    if (wasRunning) this.stop();
    const session = { task: task || this.state.task || '秒表计时', mode: 'stopwatch', startedAt: this.state.sessionStartedAt, plannedEndAt: Date.now(), durationMs: this.state.elapsedMs, status: 'completed' };
    this.state = { status: 'idle', elapsedMs: 0, startedAt: null, task: '', sessionStartedAt: null };
    this.#persistState();
    this.onTick(this.state);
    return session;
  }

  reset() {
    if (this.state.status === 'running') this.stop();
    this.state = { status: 'idle', elapsedMs: 0, startedAt: null, task: '', sessionStartedAt: null };
    this.#persistState();
    this.onTick(this.state);
  }

  restore(savedState) {
    if (!savedState) return;
    this.state = savedState;
    if (this.state.status === 'running' && this.state.startedAt) {
      // 重新计算已过时间
      const now = Date.now();
      this.state.elapsedMs = now - this.state.startedAt;
      // 检查是否超时
      if (this.state.autoStopMs && this.state.elapsedMs >= this.state.autoStopMs) {
        this.state.elapsedMs = this.state.autoStopMs;
        this.state.status = 'stopped';
        this.state.startedAt = null;
        this.#persistState();
        this.onTick(this.state);
        this.onAutoStop();
      } else if (this.state.elapsedMs >= this.MAX_TIME_MS) {
        this.state.elapsedMs = this.MAX_TIME_MS;
        this.state.status = 'stopped';
        this.state.startedAt = null;
        this.#persistState();
        this.onTick(this.state);
        this.onAutoStop();
      } else {
        // 继续计时，重新设置 startedAt 以保持正确的已过时间
        this.state.startedAt = now - this.state.elapsedMs;
        this.#persistState();
        this.intervalId = window.setInterval(() => {
          this.state.elapsedMs = Date.now() - this.state.startedAt;
          
          if (this.state.elapsedMs >= this.MAX_TIME_MS) {
            this.state.elapsedMs = this.MAX_TIME_MS;
            this.stop();
            this.onAutoStop();
            return;
          }
          
          if (this.state.autoStopMs && this.state.elapsedMs >= this.state.autoStopMs) {
            this.state.elapsedMs = this.state.autoStopMs;
            this.stop();
            this.onAutoStop();
            return;
          }
          this.onTick(this.state);
        }, 10);
        this.onTick(this.state);
      }
    } else {
      this.onTick(this.state);
    }
  }

  #persistState() {
    if (this.persist) {
      this.persist(this.state.status === 'idle' ? null : this.state);
    }
  }
}
