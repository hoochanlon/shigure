export class Stopwatch {
  constructor(onTick, onAutoStop = () => {}) {
    this.onTick = onTick;
    this.onAutoStop = onAutoStop;
    this.state = { status: 'idle', elapsedMs: 0, startedAt: null, task: '' };
    this.intervalId = null;
  }

  start({ autoStopSeconds = 0 } = {}) {
    if (this.state.status === 'running') return;
    const now = Date.now();
    const autoStopMs = Math.max(0, autoStopSeconds) * 1000;
    this.state = { status: 'running', elapsedMs: this.state.elapsedMs, startedAt: now - this.state.elapsedMs, task: this.state.task, sessionStartedAt: this.state.sessionStartedAt || now, autoStopMs };
    this.intervalId = window.setInterval(() => {
      this.state.elapsedMs = Date.now() - this.state.startedAt;
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
    this.onTick(this.state);
  }

  complete(task) {
    if (this.state.status === 'idle') return null;
    const wasRunning = this.state.status === 'running';
    if (wasRunning) this.stop();
    const session = { task: task || this.state.task || '秒表计时', mode: 'stopwatch', startedAt: this.state.sessionStartedAt, plannedEndAt: Date.now(), durationMs: this.state.elapsedMs, status: 'completed' };
    this.state = { status: 'idle', elapsedMs: 0, startedAt: null, task: '', sessionStartedAt: null };
    this.onTick(this.state);
    return session;
  }

  reset() {
    if (this.state.status === 'running') this.stop();
    this.state = { status: 'idle', elapsedMs: 0, startedAt: null, task: '', sessionStartedAt: null };
    this.onTick(this.state);
  }
}
