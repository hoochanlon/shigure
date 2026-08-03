import { Stopwatch } from './stopwatch.js';
import { saveState } from './storage.js';

export const createStopwatchController = ({ state, view, getLanguage, onAutoStop, onRunningChange }) => {
  let lastStatus = null;
  let completedSessionStartedAt = null;
  const persistState = (stopwatchState) => {
    state.activeStopwatch = stopwatchState;
    saveState(state);
  };

  const stopwatch = new Stopwatch(
    (stopwatchState) => {
      if (stopwatchState.status !== lastStatus) {
        lastStatus = stopwatchState.status;
        onRunningChange(stopwatchState.status === 'running');
      }
      view.renderStopwatch(stopwatchState, getLanguage(), state.settings.stopwatchTimeFormat);
    },
    (session) => {
      if (session.startedAt !== completedSessionStartedAt) {
        completedSessionStartedAt = session.startedAt;
        onAutoStop(session);
      }
    },
    persistState,
    (stopwatchState) => view.renderStopwatchTitle(stopwatchState, getLanguage())
  );

  // 初始化时标记已存在的已完成会话，防止重复触发
  if (state.activeStopwatch?.sessionStartedAt) {
    completedSessionStartedAt = state.activeStopwatch.sessionStartedAt;
  }

  return {
    get state() { return stopwatch.state; },
    start: () => stopwatch.start({ autoStopSeconds: state.settings.stopwatchAutoStopSeconds }),
    stop: () => stopwatch.stop(),
    complete: (task) => stopwatch.complete(task),
    reset: () => stopwatch.reset(),
    restore: () => stopwatch.restore(state.activeStopwatch),
    checkpoint: () => stopwatch.checkpoint(),
    setPresentationEnabled: (enabled) => stopwatch.setPresentationEnabled(enabled)
  };
};
