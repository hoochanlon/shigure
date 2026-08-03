export class Stopwatch {
  constructor(onTick, onAutoStop = () => {}, persist = null) {
    this.onTick = onTick;
    this.onAutoStop = onAutoStop;
    this.persist = persist;
    this.state = { status: 'idle', elapsedMs: 0, startedAt: null, task: '', sessionStartedAt: null };
    this.presentationTimeoutId = null;
    this.autoStopTimeoutId = null;
    this.isPresentationEnabled = true;
    this.MAX_TIME_MS = (99 * 3600 + 59 * 60 + 59) * 1000;
    this.PRESENTATION_INTERVAL_MS = 100;
  }

  start({ autoStopSeconds = 0 } = {}) {
    if (this.state.status === 'running') return;
    const now = Date.now();
    const autoStopMs = Math.max(0, autoStopSeconds) * 1000;
    this.state = { status: 'running', elapsedMs: this.state.elapsedMs, startedAt: now - this.state.elapsedMs, task: this.state.task, sessionStartedAt: this.state.sessionStartedAt || now, autoStopMs };
    this.#persistState();
    this.#startScheduling();
  }

  stop() {
    if (this.state.status !== 'running') return;
    this.#cancelScheduling();
    this.#updateElapsed();
    this.state = { status: 'stopped', elapsedMs: this.state.elapsedMs, startedAt: null, task: this.state.task, sessionStartedAt: this.state.sessionStartedAt };
    this.#persistState();
    this.onTick(this.state);
  }

  complete(task) {
    if (this.state.status === 'idle') return null;
    if (this.state.status === 'running') this.stop();
    const session = { task: task || this.state.task || '', mode: 'stopwatch', startedAt: this.state.sessionStartedAt, plannedEndAt: Date.now(), durationMs: this.state.elapsedMs, status: 'completed' };
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
    const isRunning = savedState.status === 'running';
    if (isRunning && savedState.startedAt) {
      const now = Date.now();
      const elapsedMs = Math.max(0, Math.min(now - savedState.startedAt, this.MAX_TIME_MS));
      this.state = { ...this.state, ...savedState, elapsedMs, startedAt: now - elapsedMs };
    } else {
      const elapsedMs = Math.max(0, Number(savedState.elapsedMs) || 0);
      this.state = { ...this.state, ...savedState, elapsedMs, startedAt: null };
    }
    if (!isRunning) return this.onTick(this.state);
    this.#updateElapsed();
    if (this.#hasReachedDeadline()) return this.#stopForDeadline();
    this.#persistState();
    this.#startScheduling();
  }

  checkpoint() {
    if (this.state.status !== 'running') return;
    this.#updateElapsed();
    this.#persistState();
  }

  setPresentationEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    if (this.isPresentationEnabled === nextEnabled) return;
    this.isPresentationEnabled = nextEnabled;
    if (this.state.status !== 'running') return;
    window.clearTimeout(this.presentationTimeoutId);
    this.presentationTimeoutId = null;
    if (nextEnabled) this.#present();
  }

  #startScheduling() {
    this.#scheduleAutoStop();
    if (this.isPresentationEnabled) this.#present();
  }

  #present() {
    if (this.state.status !== 'running' || !this.isPresentationEnabled) return;
    this.#updateElapsed();
    if (this.#hasReachedDeadline()) return this.#stopForDeadline();
    this.onTick(this.state);
    this.presentationTimeoutId = window.setTimeout(() => this.#present(), this.PRESENTATION_INTERVAL_MS);
  }

  #scheduleAutoStop() {
    const remainingMs = Math.max(0, this.#deadlineMs() - this.state.elapsedMs);
    this.autoStopTimeoutId = window.setTimeout(() => {
      if (this.state.status !== 'running') return;
      this.#updateElapsed();
      if (this.#hasReachedDeadline()) this.#stopForDeadline();
      else this.#scheduleAutoStop();
    }, remainingMs);
  }

  #deadlineMs() {
    const autoStopMs = Number(this.state.autoStopMs) || 0;
    return autoStopMs ? Math.min(autoStopMs, this.MAX_TIME_MS) : this.MAX_TIME_MS;
  }

  #hasReachedDeadline() { return this.state.elapsedMs >= this.#deadlineMs(); }

  #updateElapsed() {
    if (this.state.startedAt) this.state.elapsedMs = Math.min(Date.now() - this.state.startedAt, this.#deadlineMs());
  }

  #stopForDeadline() {
    this.#cancelScheduling();
    this.state.elapsedMs = this.#deadlineMs();
    const session = { task: this.state.task || '', mode: 'stopwatch', startedAt: this.state.sessionStartedAt, plannedEndAt: Date.now(), durationMs: this.state.elapsedMs, status: 'completed' };
    this.state = { status: 'idle', elapsedMs: 0, startedAt: null, task: '', sessionStartedAt: null };
    this.#persistState();
    this.onTick(this.state);
    this.onAutoStop(session);
  }

  #cancelScheduling() {
    if (this.presentationTimeoutId !== null) window.clearTimeout(this.presentationTimeoutId);
    if (this.autoStopTimeoutId !== null) window.clearTimeout(this.autoStopTimeoutId);
    this.presentationTimeoutId = null;
    this.autoStopTimeoutId = null;
  }

  #persistState() {
    if (this.persist) this.persist(this.state.status === 'idle' ? null : this.state);
  }
}
