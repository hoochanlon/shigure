import { Timer } from './timer.js';
import { saveState } from './storage.js';

export const createTimerController = ({ state, view, getLanguage, onCompleted, onRunningChange, onStateChange = () => {} }) => {
  const persistState = (timerState) => {
    state.activeTimer = timerState;
    saveState(state);
  };

  let lastStatus = null;
  let completedSessionId = null;
  const renderTimer = (timerState) => {
    const configuredMinutes = timerState.session?.mode === 'break' ? state.settings.breakMinutes : state.settings.workMinutes;
    view.renderTimer({ ...timerState, defaultDurationMs: configuredMinutes * 60_000 }, getLanguage());
  };
  const timer = new Timer((timerState) => {
    if (timerState.status === 'completed' && timerState.session?.id !== completedSessionId) {
      completedSessionId = timerState.session?.id;
      onCompleted(timerState.session);
    }
    if (timerState.status !== lastStatus) {
      lastStatus = timerState.status;
      onRunningChange(timerState.status === 'running');
    }
    renderTimer(timerState);
    onStateChange(timerState);
  }, persistState, (timerState) => view.renderTimerTitle(timerState, getLanguage()));

  // 初始化时标记已存在的已完成会话，防止重复触发
  if (state.activeTimer?.status === 'completed' && state.activeTimer?.session?.id) {
    completedSessionId = state.activeTimer.session.id;
  }

  return {
    get state() { return timer.state; },
    start: ({ task, mode, minutes }) => timer.start({ task, mode, minutes }),
    pause: () => timer.pause(),
    resume: () => timer.resume(),
    stop: () => timer.stop(),
    reset: () => timer.reset(),
    restore: () => timer.restore(state.activeTimer),
    checkpoint: () => timer.checkpoint(),
    setPresentationActive: (active) => timer.setPresentationActive(active)
  };
};
