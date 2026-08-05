import { translate } from './i18n.js';

const timerTime = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.floor((milliseconds || 0) / 1000));
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
};
const stopwatchTime = (milliseconds) => {
  const totalMs = Math.max(0, Math.floor(milliseconds || 0));
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const fractions = Math.floor((totalMs % 1000) / 10);
  const secondsPart = `${String(seconds).padStart(2, '0')}.${String(fractions).padStart(2, '0')}`;
  return hours ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${secondsPart}` : `${String(minutes).padStart(2, '0')}:${secondsPart}`;
};

export const createPictureInPictureController = ({ root, getLanguage, getMode, getTimerState, getStopwatchState, getTask, timerActions, stopwatchActions, onAvailabilityChange }) => {
  const pipApi = root.defaultView.documentPictureInPicture;
  let pipWindow = null;
  let supported = Boolean(pipApi?.requestWindow);
  const labels = (key) => translate(getLanguage(), key);
  const theme = () => {
    const window = root.defaultView;
    const styles = window.getComputedStyle(root.documentElement);
    const actionStyle = (id) => window.getComputedStyle(root.getElementById(id));
    const primary = actionStyle('start-work');
    const success = actionStyle('start-break');
    const danger = actionStyle('stop-timer');
    return [
      '--bg', '--glass', '--ink', '--muted', '--line', '--blue', '--danger'
    ].map((name) => `${name}:${styles.getPropertyValue(name).trim()}`).concat([
      `--pip-primary-bg:${primary.backgroundColor}`,
      `--pip-primary-ink:${primary.color}`,
      `--pip-success-bg:${success.backgroundColor}`,
      `--pip-success-ink:${success.color}`,
      `--pip-danger-bg:${danger.backgroundColor}`,
      `--pip-danger-ink:${danger.color}`
    ]).join(';');
  };
  const syncTheme = () => {
    if (!pipWindow) return;
    pipWindow.document.documentElement.style.cssText = theme();
  };
  const themeObserver = new root.defaultView.MutationObserver(syncTheme);
  themeObserver.observe(root.documentElement, { attributes: true, attributeFilter: ['class'] });
  const updateButton = () => onAvailabilityChange?.({ supported, open: Boolean(pipWindow) });
  const close = () => {
    if (!pipWindow) return;
    pipWindow.close();
  };
  const renderWindow = () => {
    if (!pipWindow) return;
    const doc = pipWindow.document;
    const mode = getMode();
    const timer = getTimerState();
    const stopwatch = getStopwatchState();
    const isTimer = mode === 'pomodoro';
    const status = isTimer ? timer.status : stopwatch.status;
    const time = isTimer ? timerTime(timer.remainingMs) : stopwatchTime(stopwatch.elapsedMs);
    const task = getTask() || labels('untitledTask');
    const modeLabel = isTimer ? labels('guide') : labels('stopwatch');
    const stateLabel = isTimer
      ? (status === 'running' ? labels(timer.session?.mode === 'break' ? 'breakMode' : 'workMode') : labels(status === 'paused' ? 'paused' : 'ready'))
      : (status === 'running' ? labels('stopwatchRunning') : labels(['paused', 'stopped'].includes(status) ? 'stopwatchPaused' : 'ready'));
    syncTheme();
    doc.title = `${modeLabel} · ${stateLabel}`;
    doc.querySelector('.pip-root')?.setAttribute('data-pip-kind', isTimer ? 'timer' : 'stopwatch');
    doc.querySelector('[data-pip-mode]').textContent = modeLabel;
    doc.querySelector('[data-pip-state]').textContent = stateLabel;
    doc.querySelector('[data-pip-time]').textContent = time;
    doc.querySelector('[data-pip-task]').textContent = task;
    const timerIsActive = ['running', 'paused'].includes(timer.status);
    doc.querySelector('[data-pip-start-work]')?.toggleAttribute('hidden', !isTimer);
    doc.querySelector('[data-pip-start-work]')?.toggleAttribute('disabled', timerIsActive);
    doc.querySelector('[data-pip-start-break]')?.toggleAttribute('hidden', !isTimer);
    doc.querySelector('[data-pip-start-break]')?.toggleAttribute('disabled', timerIsActive);
    doc.querySelector('[data-pip-timer-complete]')?.toggleAttribute('hidden', !isTimer);
    doc.querySelector('[data-pip-timer-complete]')?.toggleAttribute('disabled', !timerIsActive);
    doc.querySelector('[data-pip-stopwatch-start]')?.toggleAttribute('hidden', isTimer);
    doc.querySelector('[data-pip-stopwatch-start]')?.toggleAttribute('disabled', stopwatch.status === 'running');
    doc.querySelector('[data-pip-stopwatch-complete]')?.toggleAttribute('hidden', isTimer);
    doc.querySelector('[data-pip-stopwatch-complete]')?.toggleAttribute('disabled', stopwatch.status === 'idle');
  };
  const bindWindow = () => {
    if (!pipWindow) return;
    pipWindow.document.body.addEventListener('click', (event) => {
      const action = event.target.closest('[data-pip-action]')?.dataset.pipAction;
      if (!action) return;
      if (action === 'close') close();
      if (action === 'start-work') timerActions.startWork();
      if (action === 'start-break') timerActions.startBreak();
      if (action === 'timer-complete') timerActions.stop();
      if (action === 'stopwatch-start') stopwatchActions.start();
      if (action === 'stopwatch-complete') stopwatchActions.complete(getTask());
      renderWindow();
    });
    pipWindow.addEventListener('pagehide', () => {
      pipWindow = null;
      updateButton();
    }, { once: true });
  };
  const open = async () => {
    if (pipWindow) return;
    if (!supported) {
      onAvailabilityChange?.({ supported: false, open: false });
      return;
    }
    try {
      pipWindow = await pipApi.requestWindow({ width: 400, height: 280 });
      const doc = pipWindow.document;
      doc.head.innerHTML = `<meta name="color-scheme" content="light dark"><style>:root{${theme()}}*{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden}body{color:var(--ink);background:radial-gradient(circle at 50% -20%,color-mix(in srgb,var(--blue) 13%,transparent),transparent 52%),var(--bg);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pip-root{width:100%;height:100%;display:grid;grid-template-rows:auto auto auto;align-content:center;padding:clamp(12px,3vmin,28px) clamp(12px,3vmin,28px) clamp(24px,7vmin,52px);gap:clamp(8px,2vmin,18px)}.pip-topline{display:flex;align-items:center;justify-content:space-between;min-width:0}.pip-meta{display:flex;align-items:center;gap:clamp(6px,1.6vmin,12px);min-width:0;color:var(--muted);font-size:clamp(12px,2.8vmin,20px);font-weight:650;letter-spacing:.03em}.pip-state{display:flex;align-items:center;gap:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pip-state::before{width:6px;height:6px;flex:0 0 6px;border-radius:50%;background:var(--blue);content:""}.pip-close{display:grid;width:clamp(26px,6vmin,38px);height:clamp(26px,6vmin,38px);place-items:center;border:0;border-radius:50%;color:var(--muted);background:transparent;font-size:clamp(20px,5vmin,30px);line-height:1;cursor:pointer}.pip-close:hover,.pip-close:focus-visible{color:var(--ink);background:color-mix(in srgb,var(--blue) 12%,transparent)}.pip-clock{display:grid;min-height:0;align-content:center;justify-items:center;gap:clamp(10px,2.8vmin,24px)}.pip-time{max-width:100%;color:var(--ink);font-size:min(40vw,58vh);font-weight:250;line-height:.82;letter-spacing:-.06em;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:center}.pip-root[data-pip-kind="stopwatch"] .pip-time{font-size:min(30vw,48vh);letter-spacing:-.07em}.pip-rule{width:min(100%,72vmin);height:2px;background:var(--blue);opacity:.9}.pip-task{max-width:min(100%,68vmin);overflow:hidden;color:var(--muted);font-size:clamp(13px,3vmin,22px);line-height:1.3;text-align:center;text-overflow:ellipsis;white-space:nowrap}.pip-actions{display:flex;justify-content:center;gap:clamp(6px,1.8vmin,14px);flex-wrap:wrap;margin-top:clamp(4px,1.4vmin,14px)}.pip-actions button{min-height:clamp(32px,7vmin,48px);padding:clamp(6px,1.5vmin,11px) clamp(11px,3vmin,22px);border:0;border-radius:999px;color:var(--muted);background:color-mix(in srgb,var(--blue) 10%,transparent);font-family:inherit;font-size:clamp(12px,2.7vmin,18px);font-weight:600;cursor:pointer}.pip-actions button:hover:not(:disabled),.pip-actions button:focus-visible{color:var(--blue);background:color-mix(in srgb,var(--blue) 18%,transparent)}.pip-actions .pip-action-primary{color:var(--pip-primary-ink);background:var(--pip-primary-bg)}.pip-actions .pip-action-success{color:var(--pip-success-ink);background:var(--pip-success-bg)}.pip-actions .pip-action-danger{color:var(--pip-danger-ink);background:var(--pip-danger-bg)}.pip-actions button:disabled{cursor:not-allowed;opacity:.4}[hidden]{display:none!important}@media (max-height:220px){.pip-root{gap:6px;padding:8px 12px 18px}.pip-task,.pip-rule{display:none}.pip-time{font-size:min(38vw,64vh)}.pip-root[data-pip-kind="stopwatch"] .pip-time{font-size:min(27vw,56vh)}.pip-actions button{min-height:24px;padding:3px 9px}}@media (max-width:260px){.pip-meta{font-size:10px}.pip-state{max-width:40vw}.pip-actions{gap:4px}.pip-actions button{padding-inline:8px}}</style>`;
      doc.body.innerHTML = `<main class="pip-root"><header class="pip-topline"><div class="pip-meta"><span data-pip-mode></span><span data-pip-state class="pip-state"></span></div><button class="pip-close" data-pip-action="close" aria-label="${labels('pictureInPictureOpen')}">×</button></header><section class="pip-clock" aria-live="polite"><strong data-pip-time class="pip-time"></strong><span class="pip-rule" aria-hidden="true"></span><div data-pip-task class="pip-task"></div></section><footer class="pip-actions"><button class="pip-action-primary" data-pip-action="start-work" data-pip-start-work>${labels('startWork')}</button><button class="pip-action-success" data-pip-action="start-break" data-pip-start-break>${labels('startBreak')}</button><button class="pip-action-danger" data-pip-action="timer-complete" data-pip-timer-complete>${labels('complete')}</button><button class="pip-action-primary" data-pip-action="stopwatch-start" data-pip-stopwatch-start>${labels('stopwatchStart')}</button><button class="pip-action-danger" data-pip-action="stopwatch-complete" data-pip-stopwatch-complete>${labels('stopwatchComplete')}</button></footer></main>`;
      bindWindow();
      renderWindow();
      updateButton();
    } catch {
      pipWindow = null;
      updateButton();
    }
  };
  updateButton();
  return { open, close, update: renderWindow, isOpen: () => Boolean(pipWindow), isSupported: () => supported };
};
