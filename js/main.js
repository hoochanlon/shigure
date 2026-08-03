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

const state = loadState();
let language = localStorage.getItem('pomodoro.timer.language') || 'zh';
let mode = 'pomodoro';
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
  stopwatch.setPresentationEnabled(pageVisible && mode === 'stopwatch');
  timer.setPresentationActive(pageVisible && mode === 'pomodoro');
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
const render = () => {
  view.applyLanguage(language);
  view.renderTimer({ ...timer.state, remainingMs: timer.state.remainingMs ?? state.settings.workMinutes * 60_000 }, language);
  view.renderStopwatch(stopwatch.state, language, state.settings.stopwatchTimeFormat);
  sessions.render();
};
const setLanguage = (nextLanguage) => {
  language = nextLanguage;
  localStorage.setItem('pomodoro.timer.language', language);
};

createEventBinder({
  state, elements, view, getLanguage, setLanguage, getMode, switchMode, timer, stopwatch,
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
switchMode('pomodoro');
render();
timer.restore();
stopwatch.restore();
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
