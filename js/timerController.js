import { Timer } from './timer.js';
import { saveState } from './storage.js';

export const createTimerController = ({ state, view, getLanguage, onCompleted, onRunningChange }) => {
  const persistState = (timerState) => {
    state.activeTimer = timerState;
    saveState(state);
  };

  let lastStatus = null;
  let completedSessionId = null;
  const timer = new Timer((timerState) => {
    if (timerState.status === 'completed' && timerState.session?.id !== completedSessionId) {
      completedSessionId = timerState.session?.id;
      onCompleted(timerState.session);
    }
    if (timerState.status !== lastStatus) {
      lastStatus = timerState.status;
      onRunningChange(timerState.status === 'running');
    }
    view.renderTimer(timerState, getLanguage());
  }, persistState, (timerState) => view.renderTimerTitle(timerState, getLanguage()));

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
