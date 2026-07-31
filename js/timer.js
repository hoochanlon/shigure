export class Timer {
  #intervalId = null;
  #state = { status: 'idle', session: null, remainingMs: null };

  constructor(onTick) { this.onTick = onTick; }
  get state() { return this.#state; }

  start({ task, mode, minutes }) {
    if (this.#state.status === 'running' || this.#state.status === 'paused') return;
    const durationMs = minutes * 60_000;
    const startedAt = Date.now();
    this.#state = { status: 'running', remainingMs: durationMs, session: { id: crypto.randomUUID?.() ?? String(startedAt), task, mode, startedAt, plannedEndAt: startedAt + durationMs, durationMs } };
    this.#beginTicking();
  }

  pause() {
    if (this.#state.status !== 'running') return;
    window.clearInterval(this.#intervalId);
    this.#intervalId = null;
    this.#state = { ...this.#state, status: 'paused', remainingMs: this.#remainingMs() };
    this.#emit();
  }

  resume() {
    if (this.#state.status !== 'paused') return;
    const plannedEndAt = Date.now() + this.#state.remainingMs;
    this.#state = { ...this.#state, status: 'running', session: { ...this.#state.session, plannedEndAt } };
    this.#beginTicking();
  }

  stop(status = 'stopped') {
    if (!['running', 'paused'].includes(this.#state.status)) return null;
    window.clearInterval(this.#intervalId);
    this.#intervalId = null;
    const session = { ...this.#state.session, endedAt: Date.now(), status };
    this.#state = { status, session, remainingMs: 0 };
    this.#emit();
    return session;
  }

  reset() {
    window.clearInterval(this.#intervalId);
    this.#intervalId = null;
    this.#state = { status: 'idle', session: null, remainingMs: null };
    this.#emit();
  }

  #remainingMs() { return Math.max(0, this.#state.session.plannedEndAt - Date.now()); }

  #beginTicking() {
    this.#tick();
    this.#intervalId = window.setInterval(() => this.#tick(), 250);
  }

  #tick() {
    const remainingMs = this.#remainingMs();
    this.#state = { ...this.#state, remainingMs };
    this.#emit();
    if (remainingMs === 0) this.stop('completed');
  }

  #emit() { this.onTick(this.#state); }
}
