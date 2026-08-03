const STORAGE_KEY = 'pomodoro.timer.state';
const LEGACY_KEY = 'tomatoData';

const defaultState = () => ({ version: 1, settings: { workMinutes: 25, breakMinutes: 5, cycleMode: 'off', stopwatchAutoStopSeconds: 0, stopwatchTimeFormat: 'smart', ambientEnabled: false, ambientVolume: 0.35, ambientSound: 'rain.mp3', alertEnabled: true, alertVolume: 0.7, pomodoroAlertEnabled: true, breakAlertEnabled: true, workAlertSound: 'piano-film-head-advertising-rhythm-light-background-material.mp3', breakAlertSound: 'Westminster-chimes.mp3', stopwatchAlertEnabled: true, stopwatchAlertSound: 'nokia.mp3', tickingEnabled: false, wallpaper: 'light', themeMode: 'manual', enterToStart: false, zenMode: false }, sessions: [], activeTimer: null, activeStopwatch: null, pomodoroResetAt: null });
const isRecord = (value) => value && typeof value === 'object';

const migrateLegacy = (legacy) => {
  const sessions = Object.values(legacy?.taskList ?? {}).map((task) => ({
    id: String(task.planStartTime),
    task: task.taskName || '',
    mode: task.taskName === '休息一下，^_^' ? 'break' : 'work',
    startedAt: task.planStartTime,
    plannedEndAt: task.planStopTime,
    endedAt: task.stopTime,
    status: task.stopTime && Math.abs(task.stopTime - task.planStopTime) < 60_000 ? 'completed' : task.stopTime ? 'stopped' : 'abandoned'
  })).sort((a, b) => b.startedAt - a.startedAt);
  return { ...defaultState(), sessions };
};

const validPomodoroAlertSounds = new Set(['ring.mp3', 'nokia.mp3', 'ringtone.mp3', 'Westminster-chimes.mp3', 'school-bell-for-recess.mp3', 'toy-piano.mp3', 'piano-film-head-advertising-rhythm-light-background-material.mp3']);
const validCycleModes = new Set(['off', 'once', 'continuous']);

export const loadState = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isRecord(stored) && stored.version === 1) {
      const state = { ...defaultState(), ...stored, settings: { ...defaultState().settings, ...stored.settings } };
      if (typeof stored.settings?.breakAlertEnabled !== 'boolean') {
        state.settings.breakAlertEnabled = state.settings.pomodoroAlertEnabled;
      }
      if (!validCycleModes.has(stored.settings?.cycleMode)) {
        state.settings.cycleMode = stored.settings?.autoLoop ? 'continuous' : 'off';
      }
      delete state.settings.autoLoop;
      const legacyAlertSound = validPomodoroAlertSounds.has(stored.settings?.pomodoroAlertSound) ? stored.settings.pomodoroAlertSound : null;
      if (legacyAlertSound && !stored.settings?.workAlertSound) state.settings.workAlertSound = legacyAlertSound;
      if (legacyAlertSound && !stored.settings?.breakAlertSound) state.settings.breakAlertSound = legacyAlertSound;
      if (!validPomodoroAlertSounds.has(state.settings.workAlertSound)) {
        state.settings.workAlertSound = defaultState().settings.workAlertSound;
      }
      if (!validPomodoroAlertSounds.has(state.settings.breakAlertSound)) {
        state.settings.breakAlertSound = defaultState().settings.breakAlertSound;
      }
      delete state.settings.pomodoroAlertSound;
      // 迁移旧的氛围音字段名
      if (typeof stored.settings?.rainEnabled === 'boolean' && typeof state.settings.ambientEnabled !== 'boolean') {
        state.settings.ambientEnabled = stored.settings.rainEnabled;
      }
      if (typeof stored.settings?.rainVolume === 'number' && typeof state.settings.ambientVolume !== 'number') {
        state.settings.ambientVolume = stored.settings.rainVolume;
      }
      delete state.settings.rainEnabled;
      delete state.settings.rainVolume;
      return state;
    }
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
export const getDefaultSettings = () => defaultState().settings;
