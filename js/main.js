import { createAudioPlayer } from './audio.js';
import { loadState, saveState } from './storage.js';
import { translate } from './i18n.js';
import { Timer } from './timer.js';
import { Stopwatch } from './stopwatch.js';
import { createView } from './view.js';
import { siteConfig } from './config.js';

const state = loadState();
let language = localStorage.getItem('pomodoro.timer.language') || 'zh';
const view = createView();
const { elements } = view;
const sound = createAudioPlayer('./assets/audio/ring.mp3');
const rain = createAudioPlayer('./assets/audio/rain.mp3', { loop: true, volume: state.settings.rainVolume });
const persist = () => saveState(state);
const getMinutes = (element) => Number(element.value);
const getSeconds = (element) => Number(element.value);
const isValidMinutes = (value) => (value === 0 || (Number.isFinite(value) && value > 0 && value <= 99));
const isPlaceholder = (value) => value.trim() === '';

const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
const resolveWallpaper = () => state.settings.themeMode === 'system' ? (systemTheme.matches ? 'dark' : 'light') : state.settings.wallpaper;

const applySettings = () => { elements['work-minutes'].value = state.settings.workMinutes; elements['break-minutes'].value = state.settings.breakMinutes; elements['auto-loop'].checked = state.settings.autoLoop; elements['stopwatch-auto-stop'].value = state.settings.stopwatchAutoStopSeconds; elements['zen-work-minutes'].value = state.settings.workMinutes; elements['zen-break-minutes'].value = state.settings.breakMinutes; elements['zen-auto-loop'].checked = state.settings.autoLoop; elements['zen-stopwatch-auto-stop'].value = state.settings.stopwatchAutoStopSeconds; sound.setVolume(state.settings.alertVolume); view.renderAlert(state.settings.alertEnabled, state.settings.alertVolume); view.renderNoise(state.settings.rainEnabled, state.settings.rainVolume); view.renderWallpaper(resolveWallpaper(), state.settings.themeMode); elements['zen-toggle'].checked = state.settings.zenMode; document.documentElement.classList.remove('zen-mode-preload'); document.body.classList.toggle('zen-mode', state.settings.zenMode); elements['zen-settings'].hidden = !state.settings.zenMode; };
const render = (timerState = timer.state) => { view.applyLanguage(language); view.renderTimer({ ...timerState, remainingMs: timerState.remainingMs ?? state.settings.workMinutes * 60_000 }, language); view.renderHistory(state.sessions, language, deleteHistoryItem); };
const saveSettings = () => { let workMinutes = getMinutes(elements['work-minutes']); let breakMinutes = getMinutes(elements['break-minutes']); if (!isValidMinutes(workMinutes) || !isValidMinutes(breakMinutes)) { window.alert(translate(language, 'invalidDuration')); applySettings(); return false; } if (workMinutes === 0) workMinutes = siteConfig.defaults.workMinutes; if (breakMinutes === 0) breakMinutes = siteConfig.defaults.breakMinutes; state.settings = { ...state.settings, workMinutes, breakMinutes, autoLoop: elements['auto-loop'].checked }; persist(); applySettings(); render(); return true; };
const saveZenPomodoroSettings = () => { let workMinutes = getMinutes(elements['zen-work-minutes']); let breakMinutes = getMinutes(elements['zen-break-minutes']); if (!isValidMinutes(workMinutes) || !isValidMinutes(breakMinutes)) { window.alert(translate(language, 'invalidDuration')); applySettings(); return false; } if (workMinutes === 0) workMinutes = siteConfig.defaults.workMinutes; if (breakMinutes === 0) breakMinutes = siteConfig.defaults.breakMinutes; state.settings = { ...state.settings, workMinutes, breakMinutes, autoLoop: elements['zen-auto-loop'].checked }; persist(); applySettings(); render(); return true; };
const saveZenStopwatchSettings = () => { const stopwatchAutoStopSeconds = getSeconds(elements['zen-stopwatch-auto-stop']); if (!Number.isInteger(stopwatchAutoStopSeconds) || stopwatchAutoStopSeconds < 0) { window.alert(translate(language, 'invalidAutoStop')); applySettings(); return false; } state.settings = { ...state.settings, stopwatchAutoStopSeconds }; persist(); applySettings(); return true; };
const saveStopwatchSettings = () => { const stopwatchAutoStopSeconds = getSeconds(elements['stopwatch-auto-stop']); if (!Number.isInteger(stopwatchAutoStopSeconds) || stopwatchAutoStopSeconds < 0) { window.alert(translate(language, 'invalidAutoStop')); applySettings(); return false; } state.settings = { ...state.settings, stopwatchAutoStopSeconds }; persist(); return true; };
const record = (session) => { state.sessions.unshift(session); state.sessions = state.sessions.slice(0, 100); persist(); view.renderHistory(state.sessions, language, deleteHistoryItem); if (!elements['zen-history-panel'].hidden) { view.renderZenHistory(state.sessions, language); } };
const deleteHistoryItem = (index) => { state.sessions.splice(index, 1); persist(); view.renderHistory(state.sessions, language, deleteHistoryItem); };
const updateRain = (enabled, volume = state.settings.rainVolume) => { state.settings = { ...state.settings, rainEnabled: enabled, rainVolume: Number(volume) }; rain.setVolume(state.settings.rainVolume); if (enabled) rain.play(); else rain.stop(); persist(); view.renderNoise(enabled, state.settings.rainVolume); };
const updateAlert = (enabled, volume = state.settings.alertVolume) => { state.settings = { ...state.settings, alertEnabled: enabled, alertVolume: Number(volume) }; sound.setVolume(state.settings.alertVolume); persist(); view.renderAlert(enabled, state.settings.alertVolume); };
const updateWallpaper = (wallpaper) => { state.settings = { ...state.settings, wallpaper, themeMode: 'manual' }; persist(); view.renderWallpaper(wallpaper, 'manual'); };
const updateThemeMode = (enabled) => { const wallpaper = enabled ? state.settings.wallpaper : resolveWallpaper(); state.settings = { ...state.settings, wallpaper, themeMode: enabled ? 'system' : 'manual' }; persist(); applySettings(); };
const updateZenMode = (enabled) => { state.settings = { ...state.settings, zenMode: enabled }; persist(); document.body.classList.toggle('zen-mode', enabled); elements['zen-settings'].hidden = !enabled; if (enabled) { document.querySelectorAll('[data-panel-target]').forEach((button) => { button.setAttribute('aria-expanded', 'false'); document.getElementById(button.dataset.panelTarget).hidden = true; }); } };
const persistStopwatchState = (stopwatchState) => { state.activeStopwatch = stopwatchState; persist(); };
const stopwatch = new Stopwatch((stopwatchState) => view.renderStopwatch(stopwatchState, language), () => { if (state.settings.alertEnabled) sound.play(); }, persistStopwatchState);
const persistTimerState = (timerState) => { state.activeTimer = timerState; persist(); };
const timer = new Timer((timerState) => { if (timerState.status === 'completed') { record(timerState.session); if (state.settings.alertEnabled) sound.play(); if (state.settings.autoLoop) window.setTimeout(() => start(timerState.session.mode === 'work' ? 'break' : 'work'), 350); } view.renderTimer(timerState, language); }, persistTimerState);
const start = (mode) => { if (!saveSettings()) return; const task = mode === 'work' ? elements['task-name'].value.trim() : translate(language, 'breakTask'); if (mode === 'work' && isPlaceholder(task)) return window.alert(translate(language, 'taskRequired')); timer.start({ task, mode, minutes: mode === 'work' ? state.settings.workMinutes : state.settings.breakMinutes }); };
const togglePanel = (button) => { const panel = document.getElementById(button.dataset.panelTarget); const isOpen = button.getAttribute('aria-expanded') === 'true'; document.querySelectorAll('[data-panel-target]').forEach((item) => { item.setAttribute('aria-expanded', 'false'); document.getElementById(item.dataset.panelTarget).hidden = true; }); button.setAttribute('aria-expanded', String(!isOpen)); panel.hidden = isOpen; };

const switchMode = (mode) => { const pomodoroView = document.getElementById('pomodoro-view'); const stopwatchView = document.getElementById('stopwatch-view'); const tabPomodoro = document.getElementById('tab-pomodoro'); const tabStopwatch = document.getElementById('tab-stopwatch'); const subtitle = document.getElementById('app-subtitle'); const zenPomodoroSettings = elements['zen-pomodoro-settings']; const zenStopwatchSettings = elements['zen-stopwatch-settings']; view.renderSettingsMode(mode); if (mode === 'pomodoro') { pomodoroView.hidden = false; stopwatchView.hidden = true; tabPomodoro.classList.add('active'); tabStopwatch.classList.remove('active'); subtitle.textContent = translate(language, 'subtitle'); if (zenPomodoroSettings) { zenPomodoroSettings.hidden = false; zenStopwatchSettings.hidden = true; } } else { pomodoroView.hidden = true; stopwatchView.hidden = false; tabPomodoro.classList.remove('active'); tabStopwatch.classList.add('active'); subtitle.textContent = translate(language, 'subtitleStopwatch'); if (zenStopwatchSettings) { zenPomodoroSettings.hidden = true; zenStopwatchSettings.hidden = false; } } };

elements['start-work'].addEventListener('click', () => start('work'));
elements['start-break'].addEventListener('click', () => start('break'));
elements['pause-resume'].addEventListener('click', () => { if (timer.state.status === 'running') timer.pause(); else timer.resume(); });
elements['stop-timer'].addEventListener('click', () => { const session = timer.stop(); if (session) record(session); });
elements['reset-timer'].addEventListener('click', () => timer.reset());
elements['language-toggle'].addEventListener('click', () => { const dropdown = document.getElementById('language-dropdown'); const isOpen = dropdown.hidden; document.querySelectorAll('.language-dropdown').forEach(d => d.hidden = true); dropdown.hidden = !isOpen; elements['language-toggle'].setAttribute('aria-expanded', String(!isOpen)); });
document.querySelectorAll('.language-option').forEach(option => { option.addEventListener('click', () => { language = option.dataset.lang; localStorage.setItem('pomodoro.timer.language', language); document.getElementById('language-dropdown').hidden = true; elements['language-toggle'].setAttribute('aria-expanded', 'false'); render(); }); });
document.addEventListener('click', (e) => { if (!e.target.closest('.language-selector')) { document.getElementById('language-dropdown').hidden = true; elements['language-toggle'].setAttribute('aria-expanded', 'false'); } });
elements['clear-history'].addEventListener('click', () => { if (window.confirm(translate(language, 'clearConfirm'))) { state.sessions = []; persist(); view.renderHistory([], language, deleteHistoryItem); } });
elements['rain-toggle'].addEventListener('change', () => updateRain(elements['rain-toggle'].checked));
elements['rain-volume'].addEventListener('input', () => updateRain(elements['rain-toggle'].checked, elements['rain-volume'].value));
elements['wallpaper-light'].addEventListener('click', () => updateWallpaper('light'));
elements['wallpaper-dark'].addEventListener('click', () => updateWallpaper('dark'));
elements['wallpaper-rain'].addEventListener('click', () => updateWallpaper('rain'));
elements['system-theme-toggle'].addEventListener('change', () => updateThemeMode(elements['system-theme-toggle'].checked));
systemTheme.addEventListener('change', () => { if (state.settings.themeMode === 'system') view.renderWallpaper(resolveWallpaper(), 'system'); });
elements['zen-toggle'].addEventListener('change', () => updateZenMode(elements['zen-toggle'].checked));
elements['zen-exit'].addEventListener('click', () => { elements['zen-toggle'].checked = false; updateZenMode(false); });
// 禅模式设置切换
elements['zen-settings-toggle'].addEventListener('click', () => {
  const panel = elements['zen-settings-panel'];
  const historyPanel = elements['zen-history-panel'];
  historyPanel.hidden = true;
  panel.hidden = !panel.hidden;
});
// 禅模式历史记录切换
elements['zen-history-toggle'].addEventListener('click', () => {
  const panel = elements['zen-settings-panel'];
  const historyPanel = elements['zen-history-panel'];
  panel.hidden = true;
  historyPanel.hidden = !historyPanel.hidden;
  if (!historyPanel.hidden) {
    view.renderZenHistory(state.sessions, language);
  }
});
// 点击其他区域关闭禅模式设置面板
document.addEventListener('click', (e) => {
  if (!e.target.closest('#zen-settings')) {
    elements['zen-settings-panel'].hidden = true;
    elements['zen-history-panel'].hidden = true;
  }
});
// 禅模式番茄钟设置变更
elements['zen-work-minutes'].addEventListener('change', saveZenPomodoroSettings);
elements['zen-break-minutes'].addEventListener('change', saveZenPomodoroSettings);
elements['zen-auto-loop'].addEventListener('change', saveZenPomodoroSettings);
// 禅模式秒表设置变更
elements['zen-stopwatch-auto-stop'].addEventListener('change', saveZenStopwatchSettings);
elements['stopwatch-start'].addEventListener('click', () => { if (saveStopwatchSettings()) stopwatch.start({ autoStopSeconds: state.settings.stopwatchAutoStopSeconds }); });
elements['stopwatch-stop'].addEventListener('click', () => stopwatch.stop());
elements['stopwatch-complete'].addEventListener('click', () => { const task = document.getElementById('stopwatch-task-name').value.trim(); const session = stopwatch.complete(task); if (session) { record(session); if (state.settings.alertEnabled) sound.play(); } });
elements['stopwatch-reset'].addEventListener('click', () => stopwatch.reset());
document.getElementById('tab-pomodoro').addEventListener('click', () => switchMode('pomodoro'));
document.getElementById('tab-stopwatch').addEventListener('click', () => switchMode('stopwatch'));
document.querySelectorAll('[data-panel-target]').forEach((button) => button.addEventListener('click', () => togglePanel(button)));
['work-minutes', 'break-minutes', 'auto-loop'].forEach((id) => elements[id].addEventListener('change', saveSettings));
elements['stopwatch-auto-stop'].addEventListener('change', saveStopwatchSettings);
elements['alert-toggle'].addEventListener('change', () => updateAlert(elements['alert-toggle'].checked));
elements['alert-volume'].addEventListener('input', () => updateAlert(elements['alert-toggle'].checked, elements['alert-volume'].value));
window.addEventListener('beforeunload', (event) => { if (timer.state.status === 'running') { event.preventDefault(); event.returnValue = ''; } });

applySettings();
view.renderSettingsMode('pomodoro');
render();
view.renderStopwatch(stopwatch.state, language);

// 恢复计时器和秒表状态
if (state.activeTimer) {
  timer.restore(state.activeTimer);
}
if (state.activeStopwatch) {
  stopwatch.restore(state.activeStopwatch);
}

// 应用配置
const brandLink = document.getElementById('brand-link');
const brandName = document.getElementById('brand-name');
if (brandLink && brandName) {
  brandLink.href = siteConfig.brand.url;
  brandLink.setAttribute('aria-label', siteConfig.brand.name);
  brandName.textContent = siteConfig.brand.name;
}

// 应用社交链接
document.querySelector('a[aria-label="GitHub"]').href = siteConfig.social.github;
document.querySelector('a[aria-label="Blog"]').href = siteConfig.social.blog;
document.querySelector('a[aria-label="Email"]').href = `mailto:${siteConfig.social.email}`;

// 应用页脚信息
const footerLink = document.querySelector('.app-footer a');
if (footerLink) {
  footerLink.href = siteConfig.footer.authorUrl;
  footerLink.textContent = siteConfig.footer.author;
}
