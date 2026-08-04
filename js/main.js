import { loadState, saveState } from './storage.js';
import { translate } from './i18n.js';
import { createView } from './view.js';
import { siteConfig } from './config.js';
import { createAudioController } from './audioController.js';
import { createSettingsController } from './settingsController.js';
import { createSessionManager } from './sessionManager.js';
import { createTimerController } from './timerController.js';
import { createStopwatchController } from './stopwatchController.js';
import { createWallpaperController } from './wallpaperController.js';
import { createEventBinder } from './eventBinder.js';
import { createSimpleDoController } from './simpleDoController.js';

const state = loadState();
// 浏览器刷新后不能可靠恢复有声媒体播放，状态必须反映本页实际播放情况。
state.settings.ambientEnabled = false;
saveState(state);
let language = localStorage.getItem('pomodoro.timer.language') || 'zh';
let mode = 'pomodoro';
let screen = 'timer';
const SCREEN_STORAGE_KEY = 'shigure.ui.screen';
const persist = () => saveState(state);
const view = createView(document, () => state.pomodoroResetAt);
const { elements } = view;
const getLanguage = () => language;
const getMode = () => mode;

let timer;
let stopwatch;
const audio = createAudioController({ state, elements, view });
const wallpaper = createWallpaperController({ state, view });
const settings = createSettingsController(state, view, elements, audio, wallpaper.render);
const sessions = createSessionManager(state, view, getLanguage, elements, getMode);

const startTimer = (nextMode) => {
  if (!settings.saveSettings(language)) return;
  audio.prepareAlertAudio();
  const task = nextMode === 'work' ? elements['task-name'].value.trim() : translate(language, 'breakTask');
  timer.start({ task, mode: nextMode, minutes: nextMode === 'work' ? state.settings.workMinutes : state.settings.breakMinutes });
};

timer = createTimerController({
  state,
  view,
  getLanguage,
  onRunningChange: () => undefined,
  onCompleted: (session) => {
    sessions.record(session);
    const enabled = session.mode === 'work' ? state.settings.pomodoroAlertEnabled : state.settings.breakAlertEnabled;
    if (enabled) session.mode === 'work' ? audio.playWorkAlert() : audio.playBreakAlert();
    const shouldAdvance = session.mode === 'work'
      ? state.settings.cycleMode !== 'off'
      : state.settings.cycleMode === 'continuous';
    if (shouldAdvance) window.setTimeout(() => startTimer(session.mode === 'work' ? 'break' : 'work'), 350);
  }
});
stopwatch = createStopwatchController({
  state,
  view,
  getLanguage,
  onAutoStop: (session) => {
    sessions.record(session);
    if (state.settings.stopwatchAlertEnabled) audio.playStopwatchAlert();
  },
  onRunningChange: () => undefined
});

const syncTimerPresentation = () => {
  const pageVisible = document.visibilityState === 'visible';
  const timerVisible = pageVisible && screen === 'timer';
  stopwatch.setPresentationEnabled(timerVisible && mode === 'stopwatch');
  timer.setPresentationActive(timerVisible && mode === 'pomodoro');
};
const switchMode = (nextMode) => {
  mode = nextMode;
  const isPomodoro = mode === 'pomodoro';
  document.getElementById('pomodoro-view').hidden = !isPomodoro;
  document.getElementById('stopwatch-view').hidden = isPomodoro;
  document.getElementById('tab-pomodoro').classList.toggle('active', isPomodoro);
  document.getElementById('tab-stopwatch').classList.toggle('active', !isPomodoro);
  document.getElementById('app-subtitle').textContent = translate(language, isPomodoro ? 'subtitle' : 'subtitleStopwatch');
  elements['zen-pomodoro-settings'].hidden = !isPomodoro;
  elements['zen-stopwatch-settings'].hidden = isPomodoro;
  view.renderSettingsMode(mode);
  sessions.render();
  syncTimerPresentation();
};
const switchScreen = (nextScreen) => {
  screen = nextScreen === 'todo' ? 'todo' : 'timer';
  localStorage.setItem(SCREEN_STORAGE_KEY, screen);
  const showingTodo = screen === 'todo';
  if (showingTodo && state.settings.zenMode) {
    elements['zen-toggle'].checked = false;
    settings.updateZenMode(false);
  }
  document.body.classList.toggle('todo-mode', showingTodo);
  document.documentElement.classList.remove('todo-mode-preload');
  document.getElementById('simple-do-screen').hidden = !showingTodo;
  if (showingTodo) {
    simpleDo.render();
    simpleDo.renderHistory();
  }
  syncTimerPresentation();
};
let simpleDo;

const render = () => {
  view.applyLanguage(language);
  view.renderTimer({ ...timer.state, defaultDurationMs: state.settings.workMinutes * 60_000 }, language);
  view.renderStopwatch(stopwatch.state, language, state.settings.stopwatchTimeFormat);
  sessions.render();
};
const setLanguage = (nextLanguage) => {
  language = nextLanguage;
  localStorage.setItem('pomodoro.timer.language', language);
};

simpleDo = createSimpleDoController({
  root: document,
  getLanguage,
  onFocus: (task) => {
    elements['task-name'].value = task;
    switchScreen('timer');
  }
});

createEventBinder({
  state, elements, view, getLanguage, setLanguage, getMode, switchMode, switchScreen, timer, stopwatch,
  settings, sessions, audio, wallpaper, persist, render
});

const restoreAmbientAfterUserGesture = () => {
  if (state.settings.ambientEnabled) audio.syncAmbient();
  document.removeEventListener('pointerdown', restoreAmbientAfterUserGesture);
  document.removeEventListener('keydown', restoreAmbientAfterUserGesture);
};
document.addEventListener('pointerdown', restoreAmbientAfterUserGesture, { once: true });
document.addEventListener('keydown', restoreAmbientAfterUserGesture, { once: true });
wallpaper.systemTheme.addEventListener('change', () => {
  if (state.settings.themeMode === 'system') wallpaper.render();
});
wallpaper.reducedMotion.addEventListener('change', wallpaper.sync);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') wallpaper.resetPerformanceSignal();
  wallpaper.sync();
  syncTimerPresentation();
  if (document.visibilityState === 'hidden') {
    timer.checkpoint();
    stopwatch.checkpoint();
  }
});
window.addEventListener('pagehide', (event) => {
  timer.checkpoint();
  stopwatch.checkpoint();
  if (!event.persisted) {
    wallpaper.dispose();
    audio.dispose();
  }
});

settings.applySettings(language);
const focusTask = localStorage.getItem('shigure.todo.focus-task');
if (focusTask) {
  elements['task-name'].value = focusTask;
  localStorage.removeItem('shigure.todo.focus-task');
}
switchMode('pomodoro');
render();
timer.restore();
stopwatch.restore();
switchScreen(localStorage.getItem(SCREEN_STORAGE_KEY));
syncTimerPresentation();

const brandLink = document.getElementById('brand-link');
const brandName = document.getElementById('brand-name');
if (brandLink && brandName) {
  brandLink.href = siteConfig.brand.url;
  brandLink.setAttribute('aria-label', siteConfig.brand.name);
  brandName.textContent = siteConfig.brand.name;
}
document.querySelector('a[aria-label="GitHub"]').href = siteConfig.social.github;
document.querySelector('a[aria-label="Blog"]').href = siteConfig.social.blog;
document.querySelector('a[aria-label="Email"]').href = `mailto:${siteConfig.social.email}`;
const footerLink = document.querySelector('.app-footer a');
if (footerLink) {
  footerLink.href = siteConfig.footer.authorUrl;
  footerLink.textContent = siteConfig.footer.author;
}
