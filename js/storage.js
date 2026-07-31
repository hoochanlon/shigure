const STORAGE_KEY = 'pomodoro.timer.state';
const LEGACY_KEY = 'tomatoData';

const defaultState = () => ({ version: 1, settings: { workMinutes: 25, breakMinutes: 5, autoLoop: false, stopwatchAutoStopSeconds: 0, rainEnabled: false, rainVolume: 0.35, alertEnabled: true, alertVolume: 0.7, wallpaper: 'light', enterToStart: false }, sessions: [] });
const isRecord = (value) => value && typeof value === 'object';

const migrateLegacy = (legacy) => {
  const sessions = Object.values(legacy?.taskList ?? {}).map((task) => ({
    id: String(task.planStartTime),
    task: task.taskName || '',
    mode: task.taskName === '休息，休息一下^_^' ? 'break' : 'work',
    startedAt: task.planStartTime,
    plannedEndAt: task.planStopTime,
    endedAt: task.stopTime,
    status: task.stopTime && Math.abs(task.stopTime - task.planStopTime) < 60_000 ? 'completed' : task.stopTime ? 'stopped' : 'abandoned'
  })).sort((a, b) => b.startedAt - a.startedAt);
  return { ...defaultState(), sessions };
};

export const loadState = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isRecord(stored) && stored.version === 1) return { ...defaultState(), ...stored, settings: { ...defaultState().settings, ...stored.settings } };
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
    if (isRecord(legacy)) {
      const migrated = migrateLegacy(legacy);
      saveState(migrated);
      return migrated;
    }
  } catch { /* Use a clean state when storage is malformed or unavailable. */ }
  return defaultState();
};

export const saveState = (state) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
