import { createAudioPlayer, createAudioManager, createBufferedPlayer, unlockAudio } from './audio.js';
import { loadState, saveState, getDefaultSettings } from './storage.js';
import { translate } from './i18n.js';
import { Timer } from './timer.js';
import { Stopwatch } from './stopwatch.js';
import { createView } from './view.js';
import { siteConfig } from './config.js';
import { parseTimeInput } from './timeParser.js';

const state = loadState();
let language = localStorage.getItem('pomodoro.timer.language') || 'zh';
const view = createView(document, () => state.pomodoroResetAt);
const { elements } = view;

// 音频管理器
const audioManager = createAudioManager();
let ambientPlayer = null;
const syncAmbient = (options = {}) => {
  const { ambientSound, ambientVolume, ambientEnabled } = state.settings;
  const { userSwitched = false } = options; // 标记用户是否主动切换
  
  // 检查是否需要切换音频文件
  const needsNewPlayer = !ambientPlayer || ambientPlayer.source !== `./assets/audio/ambient/${ambientSound}`;
  
  if (needsNewPlayer) {
    // 记住当前播放状态
    const wasPlaying = ambientPlayer ? ambientPlayer.isPlaying() : false;
    
    console.log('Creating new ambient player:', ambientSound, 'wasPlaying:', wasPlaying, 'ambientEnabled:', ambientEnabled, 'userSwitched:', userSwitched);
    
    // 停止并移除旧播放器
    if (ambientPlayer) {
      ambientPlayer.stop();
      audioManager.unregister('ambient');
    }
    
    // 创建新播放器
    ambientPlayer = createAudioPlayer(
      `./assets/audio/ambient/${ambientSound}`,
      { loop: true, volume: ambientVolume }
    );
    audioManager.register('ambient', ambientPlayer);
    
    // 播放逻辑：
    // 1. 用户主动切换声音 → 必定播放（同时更新开关状态）
    // 2. 之前在播放 → 继续播放
    // 3. 开关打开 → 播放
    if (userSwitched || wasPlaying || ambientEnabled) {
      console.log('Starting playback...');
      
      // 用户切换时，自动打开开关
      if (userSwitched && !ambientEnabled) {
        state.settings.ambientEnabled = true;
        persist();
        // 延迟更新 UI，避免在初始化时调用
        setTimeout(() => {
          if (elements['rain-toggle']) {
            elements['rain-toggle'].checked = true;
          }
        }, 0);
      }
      
      unlockAudio()
        .then(() => ambientPlayer.play())
        .then(() => console.log('Playback started successfully'))
        .catch((err) => console.error('Playback failed:', err));
    }
  } else {
    // 只是调整音量或播放状态
    ambientPlayer.setVolume(ambientVolume);
    
    if (ambientEnabled && !ambientPlayer.isPlaying()) {
      unlockAudio()
        .then(() => ambientPlayer.play())
        .catch(() => {/* 静默处理 */});
    } else if (!ambientEnabled && ambientPlayer.isPlaying()) {
      ambientPlayer.stop();
    }
  }
};
syncAmbient();

// 浏览器会拦截刷新后的有声自动播放；保留用户选择，并在首次交互时恢复。
const restoreAmbientAfterUserGesture = () => {
  if (state.settings.ambientEnabled) {
    syncAmbient();
  }
  document.removeEventListener('pointerdown', restoreAmbientAfterUserGesture);
  document.removeEventListener('keydown', restoreAmbientAfterUserGesture);
};
document.addEventListener('pointerdown', restoreAmbientAfterUserGesture, { once: true });
document.addEventListener('keydown', restoreAmbientAfterUserGesture, { once: true });
const ticking = createAudioPlayer('./assets/audio/alerts/clock-stopwatch-ticking.mp3', { loop: true, volume: 0.3, maxGain: 3.0 });
audioManager.register('ticking', ticking);

const loadAlertPlayer = (soundFile) => createBufferedPlayer(`./assets/audio/alerts/${soundFile}`, { maxGain: 3.0, volume: state.settings.alertVolume });

const workAlertPlayer = loadAlertPlayer(state.settings.workAlertSound);
const breakAlertPlayer = loadAlertPlayer(state.settings.breakAlertSound);
const stopwatchAlertPlayer = loadAlertPlayer('ring.mp3');
const alertPlayers = [workAlertPlayer, breakAlertPlayer, stopwatchAlertPlayer];
const preloadAlertPlayers = () => Promise.all(alertPlayers.map((player) => player.preload()));
const playAlert = (player) => player.play()
  .then((played) => {
    if (!played) {
      console.warn('Alert sound unavailable');
    }
  })
  .catch(() => console.warn('Alert sound failed'));
const prepareAlertAudio = () => {
  unlockAudio().catch(() => console.warn('Audio context unavailable'));
  preloadAlertPlayers().catch(() => undefined);
};

const persist = () => saveState(state);
const getMinutes = (element) => Number(element.value);
const getSeconds = (element) => {
  const input = element.value.trim();
  const parsed = parseTimeInput(input);
  return parsed !== null ? parsed : Number(input);
};
const isValidMinutes = (value) => (value === 0 || (Number.isFinite(value) && value > 0 && value <= 99));

const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const resolveWallpaper = () => state.settings.themeMode === 'system' ? (systemTheme.matches ? 'dark' : 'light') : state.settings.wallpaper;
let lofiFrameMonitorId = null;
let lofiFrameWindowStartedAt = 0;
let lofiFrameCount = 0;
let lofiLowFrameWindows = 0;
const stopLofiFrameMonitor = () => {
  if (lofiFrameMonitorId !== null) window.cancelAnimationFrame(lofiFrameMonitorId);
  lofiFrameMonitorId = null;
  lofiFrameWindowStartedAt = 0;
  lofiFrameCount = 0;
};
const monitorLofiFrameRate = (timestamp) => {
  if (resolveWallpaper() !== 'lofi-girl' || document.visibilityState !== 'visible' || reducedMotion.matches) return stopLofiFrameMonitor();
  if (!lofiFrameWindowStartedAt) lofiFrameWindowStartedAt = timestamp;
  lofiFrameCount += 1;
  const elapsed = timestamp - lofiFrameWindowStartedAt;
  if (elapsed >= 5_000) {
    lofiLowFrameWindows = lofiFrameCount / (elapsed / 1_000) < 30 ? lofiLowFrameWindows + 1 : 0;
    lofiFrameWindowStartedAt = timestamp;
    lofiFrameCount = 0;
    if (lofiLowFrameWindows >= 2) return syncLofiWallpaperMode();
  }
  lofiFrameMonitorId = window.requestAnimationFrame(monitorLofiFrameRate);
};
const syncLofiWallpaperMode = () => {
  const isLofiWallpaper = resolveWallpaper() === 'lofi-girl';
  const useStatic = isLofiWallpaper && (reducedMotion.matches || document.visibilityState !== 'visible' || lofiLowFrameWindows >= 2);
  document.documentElement.classList.toggle('use-static-lofi-wallpaper', useStatic);
  stopLofiFrameMonitor();
  if (isLofiWallpaper && !useStatic) lofiFrameMonitorId = window.requestAnimationFrame(monitorLofiFrameRate);
};

const applySettings = () => { 
  elements['work-minutes'].value = state.settings.workMinutes; 
  elements['break-minutes'].value = state.settings.breakMinutes; 
  elements['cycle-mode'].value = state.settings.cycleMode; 
  elements['stopwatch-auto-stop'].value = state.settings.stopwatchAutoStopSeconds; 
  elements['stopwatch-time-format'].value = state.settings.stopwatchTimeFormat || 'smart'; 
  elements['zen-work-minutes'].value = state.settings.workMinutes; 
  elements['zen-break-minutes'].value = state.settings.breakMinutes; 
  elements['zen-cycle-mode'].value = state.settings.cycleMode; 
  elements['zen-stopwatch-auto-stop'].value = state.settings.stopwatchAutoStopSeconds; 
  elements['zen-stopwatch-time-format'].value = state.settings.stopwatchTimeFormat || 'smart'; 
  // 应用氛围音设置
  if (elements['ambient-sound']) {
    elements['ambient-sound'].value = state.settings.ambientSound || 'rain.mp3';
    const selectedOption = document.querySelector(`#ambient-sound-dropdown [data-value="${state.settings.ambientSound || 'rain.mp3'}"]`);
    if (selectedOption && elements['ambient-sound-label']) {
      elements['ambient-sound-label'].textContent = translate(language, selectedOption.dataset.labelKey);
      elements['ambient-sound-label'].dataset.i18n = selectedOption.dataset.labelKey;
    }
  }
  alertPlayers.forEach((player) => player.setVolume(state.settings.alertVolume)); 
  view.renderAlert(state.settings.pomodoroAlertEnabled, state.settings.breakAlertEnabled, state.settings.workAlertSound, state.settings.breakAlertSound, state.settings.stopwatchAlertEnabled, state.settings.tickingEnabled, state.settings.alertVolume); 
  view.renderNoise(state.settings.ambientEnabled, state.settings.ambientVolume); 
  view.renderWallpaper(resolveWallpaper(), state.settings.themeMode); 
  syncLofiWallpaperMode();
  elements['zen-toggle'].checked = state.settings.zenMode; 
  document.documentElement.classList.remove('zen-mode-preload'); 
  document.body.classList.toggle('zen-mode', state.settings.zenMode); 
  elements['zen-settings'].hidden = !state.settings.zenMode; 
};
const render = (timerState = timer.state) => { view.applyLanguage(language); view.renderTimer({ ...timerState, remainingMs: timerState.remainingMs ?? state.settings.workMinutes * 60_000 }, language); view.renderHistory(state.sessions, language, deleteHistoryItem); };
const saveSettings = () => { let workMinutes = getMinutes(elements['work-minutes']); let breakMinutes = getMinutes(elements['break-minutes']); if (!isValidMinutes(workMinutes) || !isValidMinutes(breakMinutes)) { window.alert(translate(language, 'invalidDuration')); applySettings(); return false; } if (workMinutes === 0) workMinutes = siteConfig.defaults.workMinutes; if (breakMinutes === 0) breakMinutes = siteConfig.defaults.breakMinutes; state.settings = { ...state.settings, workMinutes, breakMinutes, cycleMode: elements['cycle-mode'].value }; persist(); applySettings(); render(); return true; };
const saveZenPomodoroSettings = () => { let workMinutes = getMinutes(elements['zen-work-minutes']); let breakMinutes = getMinutes(elements['zen-break-minutes']); if (!isValidMinutes(workMinutes) || !isValidMinutes(breakMinutes)) { window.alert(translate(language, 'invalidDuration')); applySettings(); return false; } if (workMinutes === 0) workMinutes = siteConfig.defaults.workMinutes; if (breakMinutes === 0) breakMinutes = siteConfig.defaults.breakMinutes; state.settings = { ...state.settings, workMinutes, breakMinutes, cycleMode: elements['zen-cycle-mode'].value }; persist(); applySettings(); render(); return true; };
const saveZenStopwatchSettings = () => { const stopwatchAutoStopSeconds = getSeconds(elements['zen-stopwatch-auto-stop']); if (!Number.isInteger(stopwatchAutoStopSeconds) || stopwatchAutoStopSeconds < 0) { window.alert(translate(language, 'invalidAutoStop')); applySettings(); return false; } state.settings = { ...state.settings, stopwatchAutoStopSeconds, stopwatchTimeFormat: elements['zen-stopwatch-time-format'].value }; persist(); applySettings(); const currentMode = document.getElementById('tab-stopwatch').classList.contains('active') ? 'stopwatch' : 'pomodoro'; view.updateStatsDisplay(currentMode, state.sessions, language, state.settings.stopwatchTimeFormat); return true; };
const saveStopwatchSettings = () => { const stopwatchAutoStopSeconds = getSeconds(elements['stopwatch-auto-stop']); if (!Number.isInteger(stopwatchAutoStopSeconds) || stopwatchAutoStopSeconds < 0) { window.alert(translate(language, 'invalidAutoStop')); applySettings(); return false; } state.settings = { ...state.settings, stopwatchAutoStopSeconds, stopwatchTimeFormat: elements['stopwatch-time-format'].value }; persist(); const currentMode = document.getElementById('tab-stopwatch').classList.contains('active') ? 'stopwatch' : 'pomodoro'; view.updateStatsDisplay(currentMode, state.sessions, language, state.settings.stopwatchTimeFormat); return true; };
const record = (session) => { state.sessions.unshift(session); state.sessions = state.sessions.slice(0, 100); persist(); view.renderHistory(state.sessions, language, deleteHistoryItem); if (!elements['zen-history-panel'].hidden) { view.renderZenHistory(state.sessions, language, deleteHistoryItem); } const currentMode = document.getElementById('tab-stopwatch').classList.contains('active') ? 'stopwatch' : 'pomodoro'; view.updateStatsDisplay(currentMode, state.sessions, language, state.settings.stopwatchTimeFormat); };
const deleteHistoryItem = (index) => { state.sessions.splice(index, 1); persist(); view.renderHistory(state.sessions, language, deleteHistoryItem); if (!elements['zen-history-panel'].hidden) { view.renderZenHistory(state.sessions, language, deleteHistoryItem); } const currentMode = document.getElementById('tab-stopwatch').classList.contains('active') ? 'stopwatch' : 'pomodoro'; view.updateStatsDisplay(currentMode, state.sessions, language, state.settings.stopwatchTimeFormat); };
const updateAmbient = (enabled, volume = state.settings.ambientVolume, soundFile = state.settings.ambientSound) => { 
  state.settings = { ...state.settings, ambientEnabled: enabled, ambientVolume: Number(volume), ambientSound: soundFile }; 
  persist(); 
  syncAmbient();
  view.renderNoise(enabled, state.settings.ambientVolume); 
};
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
const updateWallpaper = (wallpaper) => { state.settings = { ...state.settings, wallpaper, themeMode: 'manual' }; persist(); view.renderWallpaper(wallpaper, 'manual'); lofiLowFrameWindows = 0; syncLofiWallpaperMode(); };
const updateThemeMode = (enabled) => { const wallpaper = enabled ? state.settings.wallpaper : resolveWallpaper(); state.settings = { ...state.settings, wallpaper, themeMode: enabled ? 'system' : 'manual' }; persist(); applySettings(); };
const updateZenMode = (enabled) => { state.settings = { ...state.settings, zenMode: enabled }; persist(); document.body.classList.toggle('zen-mode', enabled); elements['zen-settings'].hidden = !enabled; if (enabled) { document.querySelectorAll('[data-panel-target]').forEach((button) => { button.setAttribute('aria-expanded', 'false'); document.getElementById(button.dataset.panelTarget).hidden = true; }); } };
const persistStopwatchState = (stopwatchState) => { state.activeStopwatch = stopwatchState; persist(); };
const stopwatch = new Stopwatch((stopwatchState) => view.renderStopwatch(stopwatchState, language, state.settings.stopwatchTimeFormat), (session) => { 
  // 自动结束时记录会话
  if (session) {
    record(session);
    view.updateStatsDisplay('stopwatch', state.sessions, language, state.settings.stopwatchTimeFormat);
  }
  // 播放提示音
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
    const shouldAdvance = timerState.session.mode === 'work'
      ? state.settings.cycleMode !== 'off'
      : state.settings.cycleMode === 'continuous';
    if (shouldAdvance) window.setTimeout(() => start(timerState.session.mode === 'work' ? 'break' : 'work'), 350);
  } 
  if (timerState.status === 'running' && state.settings.tickingEnabled) {
    audioManager.play('ticking');
  } else if (timerState.status !== 'running' && state.settings.tickingEnabled) {
    audioManager.stop('ticking');
  }
  view.renderTimer(timerState, language); 
}, persistTimerState);
const syncTimerPresentation = () => {
  const pageVisible = document.visibilityState === 'visible';
  const stopwatchVisible = pageVisible && document.getElementById('tab-stopwatch').classList.contains('active');
  const pomodoroVisible = pageVisible && document.getElementById('tab-pomodoro').classList.contains('active');
  stopwatch.setPresentationEnabled(stopwatchVisible);
  timer.setPresentationActive(pomodoroVisible);
};
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

const switchMode = (mode) => { const pomodoroView = document.getElementById('pomodoro-view'); const stopwatchView = document.getElementById('stopwatch-view'); const tabPomodoro = document.getElementById('tab-pomodoro'); const tabStopwatch = document.getElementById('tab-stopwatch'); const subtitle = document.getElementById('app-subtitle'); const zenPomodoroSettings = elements['zen-pomodoro-settings']; const zenStopwatchSettings = elements['zen-stopwatch-settings']; view.renderSettingsMode(mode); view.updateStatsDisplay(mode, state.sessions, language, state.settings.stopwatchTimeFormat); if (mode === 'pomodoro') { pomodoroView.hidden = false; stopwatchView.hidden = true; tabPomodoro.classList.add('active'); tabStopwatch.classList.remove('active'); subtitle.textContent = translate(language, 'subtitle'); if (zenPomodoroSettings) { zenPomodoroSettings.hidden = false; zenStopwatchSettings.hidden = true; } } else { pomodoroView.hidden = true; stopwatchView.hidden = false; tabPomodoro.classList.remove('active'); tabStopwatch.classList.add('active'); subtitle.textContent = translate(language, 'subtitleStopwatch'); if (zenStopwatchSettings) { zenPomodoroSettings.hidden = true; zenStopwatchSettings.hidden = false; } } syncTimerPresentation(); };

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
elements['rain-toggle'].addEventListener('change', () => updateAmbient(elements['rain-toggle'].checked));
elements['rain-volume'].addEventListener('input', () => updateAmbient(elements['rain-toggle'].checked, elements['rain-volume'].value));
elements['wallpaper-light'].addEventListener('click', () => updateWallpaper('light'));
elements['wallpaper-dark'].addEventListener('click', () => updateWallpaper('dark'));
elements['wallpaper-rain'].addEventListener('click', () => updateWallpaper('rain'));
elements['wallpaper-lofi-girl'].addEventListener('click', () => updateWallpaper('lofi-girl'));
systemTheme.addEventListener('change', () => { if (state.settings.themeMode === 'system') { view.renderWallpaper(resolveWallpaper(), 'system'); syncLofiWallpaperMode(); } });
reducedMotion.addEventListener('change', syncLofiWallpaperMode);
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
      updateAmbient(defaults.ambientEnabled, defaults.ambientVolume);
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
elements['zen-cycle-mode'].addEventListener('change', saveZenPomodoroSettings);
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
['work-minutes', 'break-minutes', 'cycle-mode'].forEach((id) => elements[id].addEventListener('change', saveSettings));
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
  currentPreviewPlayer?.dispose();
  currentPreviewPlayer = null;
};

const soundSelectors = ['work', 'break'].map((mode) => ({
  mode,
  trigger: document.getElementById(`pomodoro-${mode}-sound-trigger`),
  dropdown: document.getElementById(`pomodoro-${mode}-sound-dropdown`),
  input: document.getElementById(`pomodoro-${mode}-alert-sound`)
}));

// 氛围音选择器 - 单独处理，不与提示音混合
const ambientSelector = {
  trigger: document.getElementById('ambient-sound-trigger'),
  dropdown: document.getElementById('ambient-sound-dropdown'),
  input: document.getElementById('ambient-sound'),
  label: document.getElementById('ambient-sound-label')
};

const allSelectors = soundSelectors; // 只包含提示音选择器

const closeSoundSelectors = () => {
  allSelectors.forEach(({ trigger, dropdown }) => {
    if (trigger && dropdown) {
      dropdown.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
  stopPreview(); // 只停止提示音试听
};

// 单独关闭氛围音下拉框（不停止播放）
const closeAmbientSelector = () => {
  if (ambientSelector.trigger && ambientSelector.dropdown) {
    ambientSelector.dropdown.hidden = true;
    ambientSelector.trigger.setAttribute('aria-expanded', 'false');
  }
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

// 氛围音选择器 - 单独处理
if (ambientSelector.trigger && ambientSelector.dropdown) {
  ambientSelector.trigger.addEventListener('click', () => {
    const willOpen = ambientSelector.dropdown.hidden;
    closeSoundSelectors(); // 关闭提示音选择器
    closeAmbientSelector(); // 先关闭自己
    ambientSelector.dropdown.hidden = !willOpen;
    ambientSelector.trigger.setAttribute('aria-expanded', String(willOpen));
  });

  ambientSelector.dropdown.querySelectorAll('.custom-select-option').forEach((option) => {
    option.addEventListener('click', (event) => {
      if (event.target.closest('.option-preview-btn')) return;
      const sound = option.dataset.value;
      const labelKey = option.dataset.labelKey;
      ambientSelector.input.value = sound;
      ambientSelector.label.textContent = translate(language, labelKey);
      ambientSelector.label.dataset.i18n = labelKey;
      
      // 停止试听播放器（如果正在试听）
      stopPreview();
      
      // 更新氛围音 - 用户主动切换，标记 userSwitched
      state.settings = { ...state.settings, ambientSound: sound };
      persist();
      syncAmbient({ userSwitched: true });
      closeAmbientSelector(); // 使用专门的关闭函数
      console.log('Ambient switched to:', sound, 'Playing:', ambientPlayer?.isPlaying());
    });
  });
}

document.querySelectorAll('.option-preview-btn').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    stopPreview();
    const sound = button.dataset.sound;
    const ambientSound = button.dataset.ambientSound;
    
    if (ambientSound) {
      // 氛围音试听
      currentPreviewPlayer = createAudioPlayer(`./assets/audio/ambient/${ambientSound}`, { loop: true, volume: state.settings.ambientVolume });
    } else {
      // 铃声试听
      currentPreviewPlayer = createAudioPlayer(`./assets/audio/alerts/${sound}`, { maxGain: 3.0, volume: state.settings.alertVolume });
    }
    currentPreviewPlayer.play();
  });
});

document.addEventListener('click', (event) => {
  const clickedWrapper = event.target.closest('.custom-select-wrapper');
  
  // 如果点击的不是任何选择器，关闭所有
  if (!clickedWrapper) {
    closeSoundSelectors(); // 关闭提示音选择器
    closeAmbientSelector(); // 关闭氛围音选择器
  }
});

// 还原功能
const restoreOptionsSettings = () => {
  if (window.confirm(translate(language, 'restoreOptionsConfirm'))) {
    const defaults = getDefaultSettings();
    state.settings = {
      ...state.settings,
      workMinutes: defaults.workMinutes,
      breakMinutes: defaults.breakMinutes,
      cycleMode: defaults.cycleMode,
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
      ambientEnabled: defaults.ambientEnabled,
      ambientVolume: defaults.ambientVolume,
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
    updateAmbient(defaults.ambientEnabled, defaults.ambientVolume);
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
    updateAmbient(defaults.ambientEnabled, defaults.ambientVolume);
    updateAlert({ pomodoroEnabled: defaults.pomodoroAlertEnabled, breakEnabled: defaults.breakAlertEnabled, workSound: defaults.workAlertSound, breakSound: defaults.breakAlertSound, stopwatchEnabled: defaults.stopwatchAlertEnabled, tickingEnabled: defaults.tickingEnabled, volume: defaults.alertVolume });
    updateWallpaper(defaults.wallpaper);
    persist();
    applySettings();
    render();
  }
};

window.addEventListener('pagehide', (event) => {
  timer.checkpoint();
  stopwatch.checkpoint();
  if (!event.persisted) {
    stopPreview();
    audioManager.disposeAll();
    alertPlayers.forEach((player) => player.dispose());
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') lofiLowFrameWindows = 0;
  syncLofiWallpaperMode();
  syncTimerPresentation();
  if (document.visibilityState === 'hidden') {
    timer.checkpoint();
    stopwatch.checkpoint();
  }
});

applySettings();
view.renderSettingsMode('pomodoro');
render();
view.renderStopwatch(stopwatch.state, language, state.settings.stopwatchTimeFormat);
view.updateStatsDisplay('pomodoro', state.sessions, language, state.settings.stopwatchTimeFormat);

// 恢复计时器和秒表状态
if (state.activeTimer) {
  timer.restore(state.activeTimer);
}
if (state.activeStopwatch) {
  stopwatch.restore(state.activeStopwatch);
}
syncTimerPresentation();

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
