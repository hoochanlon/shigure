import { createAudioPlayer, createAudioManager, createBufferedPlayer, unlockAudio } from './audio.js';
import { loadState, saveState, getDefaultSettings } from './storage.js';
import { translate } from './i18n.js';
import { Timer } from './timer.js';
import { Stopwatch } from './stopwatch.js';
import { createView } from './view.js';
import { siteConfig } from './config.js';

const state = loadState();
let language = localStorage.getItem('pomodoro.timer.language') || 'zh';
const view = createView(document, () => state.pomodoroResetAt);
const { elements } = view;

// 音频管理器
const audioManager = createAudioManager();
const rain = createAudioPlayer('./assets/audio/rain.mp3', { loop: true, volume: state.settings.rainVolume });
const ticking = createAudioPlayer('./assets/audio/clock-stopwatch-ticking.mp3', { loop: true, volume: 0.3, maxGain: 3.0 });
audioManager.register('rain', rain);
audioManager.register('ticking', ticking);

const loadAlertPlayer = (soundFile) => createBufferedPlayer(`./assets/audio/${soundFile}`, { maxGain: 3.0, volume: state.settings.alertVolume });

const workAlertPlayer = loadAlertPlayer(state.settings.workAlertSound);
const breakAlertPlayer = loadAlertPlayer(state.settings.breakAlertSound);
const stopwatchAlertPlayer = loadAlertPlayer('ring.mp3');
const alertPlayers = [workAlertPlayer, breakAlertPlayer, stopwatchAlertPlayer];
const preloadAlertPlayers = () => Promise.all(alertPlayers.map((player) => player.preload()));
const playAlert = (player) => player.play()
  .then((played) => view.renderAudioStatus(played ? '' : translate(language, 'audioUnavailable')))
  .catch(() => view.renderAudioStatus(translate(language, 'audioUnavailable')));
const prepareAlertAudio = () => {
  unlockAudio()
    .then(() => view.renderAudioStatus(''))
    .catch(() => view.renderAudioStatus(translate(language, 'audioUnavailable')));
  preloadAlertPlayers().catch(() => undefined);
};

const persist = () => saveState(state);
const getMinutes = (element) => Number(element.value);
const getSeconds = (element) => Number(element.value);
const isValidMinutes = (value) => (value === 0 || (Number.isFinite(value) && value > 0 && value <= 99));

const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
const resolveWallpaper = () => state.settings.themeMode === 'system' ? (systemTheme.matches ? 'dark' : 'light') : state.settings.wallpaper;

const applySettings = () => { elements['work-minutes'].value = state.settings.workMinutes; elements['break-minutes'].value = state.settings.breakMinutes; elements['auto-loop'].checked = state.settings.autoLoop; elements['stopwatch-auto-stop'].value = state.settings.stopwatchAutoStopSeconds; elements['stopwatch-time-format'].value = state.settings.stopwatchTimeFormat || 'smart'; elements['zen-work-minutes'].value = state.settings.workMinutes; elements['zen-break-minutes'].value = state.settings.breakMinutes; elements['zen-auto-loop'].checked = state.settings.autoLoop; elements['zen-stopwatch-auto-stop'].value = state.settings.stopwatchAutoStopSeconds; elements['zen-stopwatch-time-format'].value = state.settings.stopwatchTimeFormat || 'smart'; alertPlayers.forEach((player) => player.setVolume(state.settings.alertVolume)); view.renderAlert(state.settings.pomodoroAlertEnabled, state.settings.breakAlertEnabled, state.settings.workAlertSound, state.settings.breakAlertSound, state.settings.stopwatchAlertEnabled, state.settings.tickingEnabled, state.settings.alertVolume); view.renderNoise(state.settings.rainEnabled, state.settings.rainVolume); view.renderWallpaper(resolveWallpaper(), state.settings.themeMode); elements['zen-toggle'].checked = state.settings.zenMode; document.documentElement.classList.remove('zen-mode-preload'); document.body.classList.toggle('zen-mode', state.settings.zenMode); elements['zen-settings'].hidden = !state.settings.zenMode; };
const render = (timerState = timer.state) => { view.applyLanguage(language); view.renderTimer({ ...timerState, remainingMs: timerState.remainingMs ?? state.settings.workMinutes * 60_000 }, language); view.renderHistory(state.sessions, language, deleteHistoryItem); };
const saveSettings = () => { let workMinutes = getMinutes(elements['work-minutes']); let breakMinutes = getMinutes(elements['break-minutes']); if (!isValidMinutes(workMinutes) || !isValidMinutes(breakMinutes)) { window.alert(translate(language, 'invalidDuration')); applySettings(); return false; } if (workMinutes === 0) workMinutes = siteConfig.defaults.workMinutes; if (breakMinutes === 0) breakMinutes = siteConfig.defaults.breakMinutes; state.settings = { ...state.settings, workMinutes, breakMinutes, autoLoop: elements['auto-loop'].checked }; persist(); applySettings(); render(); return true; };
const saveZenPomodoroSettings = () => { let workMinutes = getMinutes(elements['zen-work-minutes']); let breakMinutes = getMinutes(elements['zen-break-minutes']); if (!isValidMinutes(workMinutes) || !isValidMinutes(breakMinutes)) { window.alert(translate(language, 'invalidDuration')); applySettings(); return false; } if (workMinutes === 0) workMinutes = siteConfig.defaults.workMinutes; if (breakMinutes === 0) breakMinutes = siteConfig.defaults.breakMinutes; state.settings = { ...state.settings, workMinutes, breakMinutes, autoLoop: elements['zen-auto-loop'].checked }; persist(); applySettings(); render(); return true; };
const saveZenStopwatchSettings = () => { const stopwatchAutoStopSeconds = getSeconds(elements['zen-stopwatch-auto-stop']); if (!Number.isInteger(stopwatchAutoStopSeconds) || stopwatchAutoStopSeconds < 0) { window.alert(translate(language, 'invalidAutoStop')); applySettings(); return false; } state.settings = { ...state.settings, stopwatchAutoStopSeconds, stopwatchTimeFormat: elements['zen-stopwatch-time-format'].value }; persist(); applySettings(); const currentMode = document.getElementById('tab-stopwatch').classList.contains('active') ? 'stopwatch' : 'pomodoro'; view.updateStatsDisplay(currentMode, state.sessions, language, state.settings.stopwatchTimeFormat); return true; };
const saveStopwatchSettings = () => { const stopwatchAutoStopSeconds = getSeconds(elements['stopwatch-auto-stop']); if (!Number.isInteger(stopwatchAutoStopSeconds) || stopwatchAutoStopSeconds < 0) { window.alert(translate(language, 'invalidAutoStop')); applySettings(); return false; } state.settings = { ...state.settings, stopwatchAutoStopSeconds, stopwatchTimeFormat: elements['stopwatch-time-format'].value }; persist(); const currentMode = document.getElementById('tab-stopwatch').classList.contains('active') ? 'stopwatch' : 'pomodoro'; view.updateStatsDisplay(currentMode, state.sessions, language, state.settings.stopwatchTimeFormat); return true; };
const record = (session) => { state.sessions.unshift(session); state.sessions = state.sessions.slice(0, 100); persist(); view.renderHistory(state.sessions, language, deleteHistoryItem); if (!elements['zen-history-panel'].hidden) { view.renderZenHistory(state.sessions, language, deleteHistoryItem); } const currentMode = document.getElementById('tab-stopwatch').classList.contains('active') ? 'stopwatch' : 'pomodoro'; view.updateStatsDisplay(currentMode, state.sessions, language, state.settings.stopwatchTimeFormat); };
const deleteHistoryItem = (index) => { state.sessions.splice(index, 1); persist(); view.renderHistory(state.sessions, language, deleteHistoryItem); if (!elements['zen-history-panel'].hidden) { view.renderZenHistory(state.sessions, language, deleteHistoryItem); } const currentMode = document.getElementById('tab-stopwatch').classList.contains('active') ? 'stopwatch' : 'pomodoro'; view.updateStatsDisplay(currentMode, state.sessions, language, state.settings.stopwatchTimeFormat); };
const updateRain = (enabled, volume = state.settings.rainVolume) => { state.settings = { ...state.settings, rainEnabled: enabled, rainVolume: Number(volume) }; rain.setVolume(state.settings.rainVolume); if (enabled) rain.play(); else rain.stop(); persist(); view.renderNoise(enabled, state.settings.rainVolume); };
const updateAlert = ({ pomodoroEnabled, breakEnabled, workSound, breakSound, stopwatchEnabled, tickingEnabled, volume } = {}) => {
  state.settings = {
    ...state.settings,
    pomodoroAlertEnabled: pomodoroEnabled ?? state.settings.pomodoroAlertEnabled,
    breakAlertEnabled: breakEnabled ?? state.settings.breakAlertEnabled,
    workAlertSound: workSound ?? state.settings.workAlertSound,
    breakAlertSound: breakSound ?? state.settings.breakAlertSound,
    stopwatchAlertEnabled: stopwatchEnabled ?? state.settings.stopwatchAlertEnabled,
    tickingEnabled: tickingEnabled ?? state.settings.tickingEnabled,
    alertVolume: volume !== undefined ? Number(volume) : state.settings.alertVolume
  };

  if (workSound !== undefined) workAlertPlayer.setSource(`./assets/audio/${workSound}`);
  if (breakSound !== undefined) breakAlertPlayer.setSource(`./assets/audio/${breakSound}`);
  alertPlayers.forEach((player) => player.setVolume(state.settings.alertVolume));
  if (workSound !== undefined || breakSound !== undefined) preloadAlertPlayers().catch(() => undefined);

  if (tickingEnabled !== undefined) {
    if (tickingEnabled && (timer.state.status === 'running' || stopwatch.state.status === 'running')) audioManager.play('ticking');
    else audioManager.stop('ticking');
  }

  persist();
  view.renderAlert(state.settings.pomodoroAlertEnabled, state.settings.breakAlertEnabled, state.settings.workAlertSound, state.settings.breakAlertSound, state.settings.stopwatchAlertEnabled, state.settings.tickingEnabled, state.settings.alertVolume);
};
const updateWallpaper = (wallpaper) => { state.settings = { ...state.settings, wallpaper, themeMode: 'manual' }; persist(); view.renderWallpaper(wallpaper, 'manual'); };
const updateThemeMode = (enabled) => { const wallpaper = enabled ? state.settings.wallpaper : resolveWallpaper(); state.settings = { ...state.settings, wallpaper, themeMode: enabled ? 'system' : 'manual' }; persist(); applySettings(); };
const updateZenMode = (enabled) => { state.settings = { ...state.settings, zenMode: enabled }; persist(); document.body.classList.toggle('zen-mode', enabled); elements['zen-settings'].hidden = !enabled; if (enabled) { document.querySelectorAll('[data-panel-target]').forEach((button) => { button.setAttribute('aria-expanded', 'false'); document.getElementById(button.dataset.panelTarget).hidden = true; }); } };
const persistStopwatchState = (stopwatchState) => { state.activeStopwatch = stopwatchState; persist(); };
const stopwatch = new Stopwatch((stopwatchState) => view.renderStopwatch(stopwatchState, language), () => { 
  if (state.settings.stopwatchAlertEnabled && stopwatchAlertPlayer) playAlert(stopwatchAlertPlayer); 
  if (state.settings.tickingEnabled) audioManager.stop('ticking');
}, persistStopwatchState);
const persistTimerState = (timerState) => { state.activeTimer = timerState; persist(); };
const timer = new Timer((timerState) => { 
  if (timerState.status === 'completed') { 
    record(timerState.session); 
    const alertEnabled = timerState.session.mode === 'work' ? state.settings.pomodoroAlertEnabled : state.settings.breakAlertEnabled;
    if (alertEnabled) playAlert(timerState.session.mode === 'work' ? workAlertPlayer : breakAlertPlayer); 
    if (state.settings.tickingEnabled) audioManager.stop('ticking');
    if (state.settings.autoLoop) window.setTimeout(() => start(timerState.session.mode === 'work' ? 'break' : 'work'), 350); 
  } 
  if (timerState.status === 'running' && state.settings.tickingEnabled) {
    audioManager.play('ticking');
  } else if (timerState.status !== 'running' && state.settings.tickingEnabled) {
    audioManager.stop('ticking');
  }
  view.renderTimer(timerState, language); 
}, persistTimerState);
const start = (mode) => { if (!saveSettings()) return; prepareAlertAudio(); const task = mode === 'work' ? elements['task-name'].value.trim() : translate(language, 'breakTask'); timer.start({ task, mode, minutes: mode === 'work' ? state.settings.workMinutes : state.settings.breakMinutes }); };
const togglePanel = (button) => {
  const panel = document.getElementById(button.dataset.panelTarget);
  const isOpen = button.getAttribute('aria-expanded') === 'true';
  document.querySelectorAll('[data-panel-target]').forEach((item) => {
    item.setAttribute('aria-expanded', 'false');
    const targetPanel = document.getElementById(item.dataset.panelTarget);
    if (targetPanel) targetPanel.hidden = true;
  });
  button.setAttribute('aria-expanded', String(!isOpen));
  panel.hidden = isOpen;
};

const switchMode = (mode) => { const pomodoroView = document.getElementById('pomodoro-view'); const stopwatchView = document.getElementById('stopwatch-view'); const tabPomodoro = document.getElementById('tab-pomodoro'); const tabStopwatch = document.getElementById('tab-stopwatch'); const subtitle = document.getElementById('app-subtitle'); const zenPomodoroSettings = elements['zen-pomodoro-settings']; const zenStopwatchSettings = elements['zen-stopwatch-settings']; view.renderSettingsMode(mode); view.updateStatsDisplay(mode, state.sessions, language, state.settings.stopwatchTimeFormat); if (mode === 'pomodoro') { pomodoroView.hidden = false; stopwatchView.hidden = true; tabPomodoro.classList.add('active'); tabStopwatch.classList.remove('active'); subtitle.textContent = translate(language, 'subtitle'); if (zenPomodoroSettings) { zenPomodoroSettings.hidden = false; zenStopwatchSettings.hidden = true; } } else { pomodoroView.hidden = true; stopwatchView.hidden = false; tabPomodoro.classList.remove('active'); tabStopwatch.classList.add('active'); subtitle.textContent = translate(language, 'subtitleStopwatch'); if (zenStopwatchSettings) { zenPomodoroSettings.hidden = true; zenStopwatchSettings.hidden = false; } } };

elements['start-work'].addEventListener('click', () => start('work'));
elements['start-break'].addEventListener('click', () => start('break'));
elements['pause-resume'].addEventListener('click', () => { 
  if (timer.state.status === 'running') {
    timer.pause(); 
    if (state.settings.tickingEnabled) audioManager.stop('ticking');
  } else {
    timer.resume();
    if (state.settings.tickingEnabled) audioManager.play('ticking');
  }
});
elements['stop-timer'].addEventListener('click', () => { 
  const session = timer.stop(); 
  if (session) record(session); 
  if (state.settings.tickingEnabled) audioManager.stop('ticking');
});
elements['reset-timer'].addEventListener('click', () => { if (window.confirm(translate(language, 'resetPomodoroConfirm'))) { timer.reset(); if (state.settings.tickingEnabled) audioManager.stop('ticking'); state.pomodoroResetAt = Date.now(); persist(); view.renderHistory(state.sessions, language, deleteHistoryItem); if (!elements['zen-history-panel'].hidden) { view.renderZenHistory(state.sessions, language); } } });
elements['language-toggle'].addEventListener('click', () => { const dropdown = document.getElementById('language-dropdown'); const isOpen = dropdown.hidden; document.querySelectorAll('.language-dropdown').forEach(d => d.hidden = true); dropdown.hidden = !isOpen; elements['language-toggle'].setAttribute('aria-expanded', String(!isOpen)); });
document.querySelectorAll('.language-option').forEach(option => { option.addEventListener('click', () => { language = option.dataset.lang; localStorage.setItem('pomodoro.timer.language', language); document.getElementById('language-dropdown').hidden = true; elements['language-toggle'].setAttribute('aria-expanded', 'false'); render(); }); });
document.addEventListener('click', (e) => { if (!e.target.closest('.language-selector')) { document.getElementById('language-dropdown').hidden = true; elements['language-toggle'].setAttribute('aria-expanded', 'false'); } });
elements['clear-history'].addEventListener('click', () => { if (window.confirm(translate(language, 'clearConfirm'))) { state.sessions = []; persist(); view.renderHistory([], language, deleteHistoryItem); if (!elements['zen-history-panel'].hidden) { view.renderZenHistory([], language, deleteHistoryItem); } } });
elements['zen-clear-history'].addEventListener('click', () => { if (window.confirm(translate(language, 'clearConfirm'))) { state.sessions = []; persist(); view.renderHistory([], language, deleteHistoryItem); view.renderZenHistory([], language, deleteHistoryItem); } });
elements['rain-toggle'].addEventListener('change', () => updateRain(elements['rain-toggle'].checked));
elements['rain-volume'].addEventListener('input', () => updateRain(elements['rain-toggle'].checked, elements['rain-volume'].value));
elements['wallpaper-light'].addEventListener('click', () => updateWallpaper('light'));
elements['wallpaper-dark'].addEventListener('click', () => updateWallpaper('dark'));
elements['wallpaper-rain'].addEventListener('click', () => updateWallpaper('rain'));
systemTheme.addEventListener('change', () => { if (state.settings.themeMode === 'system') view.renderWallpaper(resolveWallpaper(), 'system'); });
elements['zen-toggle'].addEventListener('change', () => updateZenMode(elements['zen-toggle'].checked));
elements['zen-exit'].addEventListener('click', () => { elements['zen-toggle'].checked = false; updateZenMode(false); });
// 禅模式设置切换
elements['zen-settings-toggle'].addEventListener('click', () => {
  const panel = elements['zen-settings-panel'];
  const historyPanel = elements['zen-history-panel'];
  const restorePanel = elements['zen-restore-panel'];
  historyPanel.hidden = true;
  if (restorePanel) restorePanel.hidden = true;
  panel.hidden = !panel.hidden;
});
// 禅模式历史记录切换
elements['zen-history-toggle'].addEventListener('click', () => {
  const panel = elements['zen-settings-panel'];
  const historyPanel = elements['zen-history-panel'];
  const restorePanel = elements['zen-restore-panel'];
  panel.hidden = true;
  if (restorePanel) restorePanel.hidden = true;
  historyPanel.hidden = !historyPanel.hidden;
  if (!historyPanel.hidden) {
    view.renderZenHistory(state.sessions, language, deleteHistoryItem);
  }
});
// 禅模式还原设置按钮 - 直接还原所有
if (elements['zen-restore-settings']) {
  elements['zen-restore-settings'].addEventListener('click', () => {
    if (window.confirm(translate(language, 'restoreAllConfirm'))) {
      // 还原所有设置为默认值（选项+环境），但保留历史记录
      const defaults = getDefaultSettings();
      state.settings = { ...defaults };
      updateRain(defaults.rainEnabled, defaults.rainVolume);
      updateAlert({ pomodoroEnabled: defaults.pomodoroAlertEnabled, breakEnabled: defaults.breakAlertEnabled, workSound: defaults.workAlertSound, breakSound: defaults.breakAlertSound, stopwatchEnabled: defaults.stopwatchAlertEnabled, tickingEnabled: defaults.tickingEnabled, volume: defaults.alertVolume });
      updateWallpaper(defaults.wallpaper);
      persist();
      applySettings();
      render();
      view.updateStatsDisplay('pomodoro', state.sessions, language, state.settings.stopwatchTimeFormat);
      
      // 关闭所有弹出面板
      const panel = elements['zen-settings-panel'];
      const historyPanel = elements['zen-history-panel'];
      panel.hidden = true;
      historyPanel.hidden = true;
    }
  });
}

// 还原按钮点击外部关闭
document.addEventListener('click', (e) => {
  const restorePanel = document.getElementById('restore-panel');
  const restoreButton = document.querySelector('[data-panel-target="restore-panel"]');
  if (restorePanel && restoreButton && !restorePanel.hidden) {
    if (!e.target.closest('[data-panel-target="restore-panel"]') && !e.target.closest('#restore-panel')) {
      restorePanel.hidden = true;
      restoreButton.setAttribute('aria-expanded', 'false');
    }
  }
});

// 常规界面还原按钮
const restoreOptionsMain = document.getElementById('restore-options-main');
const restoreEnvironmentMain = document.getElementById('restore-environment-main');

if (restoreOptionsMain) {
  restoreOptionsMain.addEventListener('click', () => {
    const restorePanel = document.getElementById('restore-panel');
    const restoreButton = document.querySelector('[data-panel-target="restore-panel"]');
    if (restorePanel) restorePanel.hidden = true;
    if (restoreButton) restoreButton.setAttribute('aria-expanded', 'false');
    restoreOptionsSettings();
  });
}

if (restoreEnvironmentMain) {
  restoreEnvironmentMain.addEventListener('click', () => {
    const restorePanel = document.getElementById('restore-panel');
    const restoreButton = document.querySelector('[data-panel-target="restore-panel"]');
    if (restorePanel) restorePanel.hidden = true;
    if (restoreButton) restoreButton.setAttribute('aria-expanded', 'false');
    restoreEnvironmentSettings();
  });
}
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
elements['zen-stopwatch-time-format'].addEventListener('change', saveZenStopwatchSettings);
elements['stopwatch-start'].addEventListener('click', () => { 
  if (saveStopwatchSettings()) {
    prepareAlertAudio();
    stopwatch.start({ autoStopSeconds: state.settings.stopwatchAutoStopSeconds }); 
    if (state.settings.tickingEnabled) audioManager.play('ticking');
  }
});
elements['stopwatch-stop'].addEventListener('click', () => { 
  stopwatch.stop(); 
  if (state.settings.tickingEnabled) audioManager.stop('ticking');
});
elements['stopwatch-complete'].addEventListener('click', () => { const task = document.getElementById('stopwatch-task-name').value.trim(); const session = stopwatch.complete(task); if (session) { record(session); if (state.settings.stopwatchAlertEnabled && stopwatchAlertPlayer) stopwatchAlertPlayer.play(); if (state.settings.tickingEnabled) audioManager.stop('ticking'); view.updateStatsDisplay('stopwatch', state.sessions, language, state.settings.stopwatchTimeFormat); } });
elements['stopwatch-reset'].addEventListener('click', () => stopwatch.reset());
document.getElementById('tab-pomodoro').addEventListener('click', () => switchMode('pomodoro'));
document.getElementById('tab-stopwatch').addEventListener('click', () => switchMode('stopwatch'));
document.querySelectorAll('[data-panel-target]').forEach((button) => button.addEventListener('click', (e) => {
  e.stopPropagation(); // 阻止事件冒泡到全局监听器
  togglePanel(button);
}));
['work-minutes', 'break-minutes', 'auto-loop'].forEach((id) => elements[id].addEventListener('change', saveSettings));
elements['stopwatch-auto-stop'].addEventListener('change', saveStopwatchSettings);
elements['stopwatch-time-format'].addEventListener('change', saveStopwatchSettings);
elements['pomodoro-alert-toggle'].addEventListener('change', () => {
  const pomodoroEnabled = elements['pomodoro-alert-toggle'].checked;
  updateAlert({ pomodoroEnabled });
  if (!pomodoroEnabled) {
    workAlertPlayer.stop();
    view.renderAudioStatus('');
  }
});
elements['break-alert-toggle'].addEventListener('change', () => {
  const breakEnabled = elements['break-alert-toggle'].checked;
  updateAlert({ breakEnabled });
  if (!breakEnabled) {
    breakAlertPlayer.stop();
    view.renderAudioStatus('');
  }
});
elements['stopwatch-alert-toggle'].addEventListener('change', () => updateAlert({ stopwatchEnabled: elements['stopwatch-alert-toggle'].checked }));
elements['ticking-toggle'].addEventListener('change', () => updateAlert({ tickingEnabled: elements['ticking-toggle'].checked }));
elements['alert-volume'].addEventListener('input', () => updateAlert({ volume: elements['alert-volume'].value }));

let currentPreviewPlayer = null;
const stopPreview = () => {
  currentPreviewPlayer?.stop();
  currentPreviewPlayer = null;
};

const soundSelectors = ['work', 'break'].map((mode) => ({
  mode,
  trigger: document.getElementById(`pomodoro-${mode}-sound-trigger`),
  dropdown: document.getElementById(`pomodoro-${mode}-sound-dropdown`),
  input: document.getElementById(`pomodoro-${mode}-alert-sound`)
}));

const closeSoundSelectors = () => {
  soundSelectors.forEach(({ trigger, dropdown }) => {
    dropdown.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  });
  stopPreview();
};

soundSelectors.forEach(({ mode, trigger, dropdown, input }) => {
  trigger.addEventListener('click', () => {
    const willOpen = dropdown.hidden;
    closeSoundSelectors();
    dropdown.hidden = !willOpen;
    trigger.setAttribute('aria-expanded', String(willOpen));
  });

  dropdown.querySelectorAll('.custom-select-option').forEach((option) => {
    option.addEventListener('click', (event) => {
      if (event.target.closest('.option-preview-btn')) return;
      const sound = option.dataset.value;
      input.value = sound;
      stopPreview();
      updateAlert(mode === 'work' ? { workSound: sound } : { breakSound: sound });
      closeSoundSelectors();
    });
  });
});

document.querySelectorAll('.option-preview-btn').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    stopPreview();
    currentPreviewPlayer = createAudioPlayer(`./assets/audio/${button.dataset.sound}`, { maxGain: 3.0, volume: state.settings.alertVolume });
    currentPreviewPlayer.play();
  });
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.custom-select-wrapper')) closeSoundSelectors();
});

// 还原功能
const restoreOptionsSettings = () => {
  if (window.confirm(translate(language, 'restoreOptionsConfirm'))) {
    const defaults = getDefaultSettings();
    state.settings = {
      ...state.settings,
      workMinutes: defaults.workMinutes,
      breakMinutes: defaults.breakMinutes,
      autoLoop: defaults.autoLoop,
      stopwatchAutoStopSeconds: defaults.stopwatchAutoStopSeconds,
      stopwatchTimeFormat: defaults.stopwatchTimeFormat
    };
    persist();
    applySettings();
    render();
  }
};

const restoreEnvironmentSettings = () => {
  if (window.confirm(translate(language, 'restoreEnvironmentConfirm'))) {
    const defaults = getDefaultSettings();
    state.settings = {
      ...state.settings,
      rainEnabled: defaults.rainEnabled,
      rainVolume: defaults.rainVolume,
      pomodoroAlertEnabled: defaults.pomodoroAlertEnabled,
      breakAlertEnabled: defaults.breakAlertEnabled,
      workAlertSound: defaults.workAlertSound,
      breakAlertSound: defaults.breakAlertSound,
      stopwatchAlertEnabled: defaults.stopwatchAlertEnabled,
      tickingEnabled: defaults.tickingEnabled,
      alertVolume: defaults.alertVolume,
      wallpaper: defaults.wallpaper,
      themeMode: defaults.themeMode
    };
    updateRain(defaults.rainEnabled, defaults.rainVolume);
    updateAlert({ pomodoroEnabled: defaults.pomodoroAlertEnabled, breakEnabled: defaults.breakAlertEnabled, workSound: defaults.workAlertSound, breakSound: defaults.breakAlertSound, stopwatchEnabled: defaults.stopwatchAlertEnabled, tickingEnabled: defaults.tickingEnabled, volume: defaults.alertVolume });
    updateWallpaper(defaults.wallpaper);
    persist();
    applySettings();
  }
};

const restoreAllSettings = () => {
  if (window.confirm(translate(language, 'restoreAllConfirm'))) {
    const defaults = getDefaultSettings();
    state.settings = { ...defaults };
    updateRain(defaults.rainEnabled, defaults.rainVolume);
    updateAlert({ pomodoroEnabled: defaults.pomodoroAlertEnabled, breakEnabled: defaults.breakAlertEnabled, workSound: defaults.workAlertSound, breakSound: defaults.breakAlertSound, stopwatchEnabled: defaults.stopwatchAlertEnabled, tickingEnabled: defaults.tickingEnabled, volume: defaults.alertVolume });
    updateWallpaper(defaults.wallpaper);
    persist();
    applySettings();
    render();
  }
};

window.addEventListener('beforeunload', (event) => { if (timer.state.status === 'running') { event.preventDefault(); event.returnValue = ''; } });

applySettings();
view.renderSettingsMode('pomodoro');
render();
view.renderStopwatch(stopwatch.state, language);
view.updateStatsDisplay('pomodoro', state.sessions, language, state.settings.stopwatchTimeFormat);

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
