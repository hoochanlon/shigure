import { saveState, getDefaultSettings } from './storage.js';
import { translate } from './i18n.js';
import { siteConfig } from './config.js';
import { parseTimeInput } from './timeParser.js';

/**
 * 设置控制器 - 管理所有设置相关逻辑
 */
export const createSettingsController = (state, view, elements, audioController) => {
  const persist = () => saveState(state);
  
  // 工具函数
  const getMinutes = (element) => Number(element.value);
  const getSeconds = (element) => {
    const input = element.value.trim();
    const parsed = parseTimeInput(input);
    return parsed !== null ? parsed : Number(input);
  };
  const isValidMinutes = (value) => (value === 0 || (Number.isFinite(value) && value > 0 && value <= 99));
  
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const resolveWallpaper = () => state.settings.themeMode === 'system' 
    ? (systemTheme.matches ? 'dark' : 'light') 
    : state.settings.wallpaper;
  
  const applySettings = (language) => {
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
    
    view.renderNoise(state.settings.ambientEnabled, state.settings.ambientVolume);
    view.renderWallpaper(resolveWallpaper(), state.settings.themeMode);
    elements['zen-toggle'].checked = state.settings.zenMode;
    document.documentElement.classList.remove('zen-mode-preload');
    document.body.classList.toggle('zen-mode', state.settings.zenMode);
    elements['zen-settings'].hidden = !state.settings.zenMode;
  };
  
  const saveSettings = (language) => {
    let workMinutes = getMinutes(elements['work-minutes']);
    let breakMinutes = getMinutes(elements['break-minutes']);
    
    if (!isValidMinutes(workMinutes) || !isValidMinutes(breakMinutes)) {
      window.alert(translate(language, 'invalidDuration'));
      applySettings(language);
      return false;
    }
    
    if (workMinutes === 0) workMinutes = siteConfig.defaults.workMinutes;
    if (breakMinutes === 0) breakMinutes = siteConfig.defaults.breakMinutes;
    
    state.settings = { ...state.settings, workMinutes, breakMinutes, cycleMode: elements['cycle-mode'].value };
    persist();
    applySettings(language);
    return true;
  };
  
  const saveZenPomodoroSettings = (language) => {
    let workMinutes = getMinutes(elements['zen-work-minutes']);
    let breakMinutes = getMinutes(elements['zen-break-minutes']);
    
    if (!isValidMinutes(workMinutes) || !isValidMinutes(breakMinutes)) {
      window.alert(translate(language, 'invalidDuration'));
      applySettings(language);
      return false;
    }
    
    if (workMinutes === 0) workMinutes = siteConfig.defaults.workMinutes;
    if (breakMinutes === 0) breakMinutes = siteConfig.defaults.breakMinutes;
    
    state.settings = { ...state.settings, workMinutes, breakMinutes, cycleMode: elements['zen-cycle-mode'].value };
    persist();
    applySettings(language);
    return true;
  };
  
  const saveZenStopwatchSettings = (language) => {
    const stopwatchAutoStopSeconds = getSeconds(elements['zen-stopwatch-auto-stop']);
    
    if (!Number.isInteger(stopwatchAutoStopSeconds) || stopwatchAutoStopSeconds < 0) {
      window.alert(translate(language, 'invalidAutoStop'));
      applySettings(language);
      return false;
    }
    
    state.settings = { 
      ...state.settings, 
      stopwatchAutoStopSeconds, 
      stopwatchTimeFormat: elements['zen-stopwatch-time-format'].value 
    };
    persist();
    applySettings(language);
    
    const currentMode = document.getElementById('tab-stopwatch').classList.contains('active') 
      ? 'stopwatch' 
      : 'pomodoro';
    view.updateStatsDisplay(currentMode, state.sessions, language, state.settings.stopwatchTimeFormat);
    return true;
  };
  
  const saveStopwatchSettings = (language) => {
    const stopwatchAutoStopSeconds = getSeconds(elements['stopwatch-auto-stop']);
    
    if (!Number.isInteger(stopwatchAutoStopSeconds) || stopwatchAutoStopSeconds < 0) {
      window.alert(translate(language, 'invalidAutoStop'));
      applySettings(language);
      return false;
    }
    
    state.settings = { 
      ...state.settings, 
      stopwatchAutoStopSeconds, 
      stopwatchTimeFormat: elements['stopwatch-time-format'].value 
    };
    persist();
    
    const currentMode = document.getElementById('tab-stopwatch').classList.contains('active') 
      ? 'stopwatch' 
      : 'pomodoro';
    view.updateStatsDisplay(currentMode, state.sessions, language, state.settings.stopwatchTimeFormat);
    return true;
  };
  
  const updateWallpaper = (wallpaper) => {
    state.settings = { ...state.settings, wallpaper, themeMode: 'manual' };
    persist();
    view.renderWallpaper(wallpaper, 'manual');
  };
  
  const updateZenMode = (enabled) => {
    state.settings = { ...state.settings, zenMode: enabled };
    persist();
    document.body.classList.toggle('zen-mode', enabled);
    elements['zen-settings'].hidden = !enabled;
    
    if (enabled) {
      document.querySelectorAll('[data-panel-target]').forEach((button) => {
        button.setAttribute('aria-expanded', 'false');
        document.getElementById(button.dataset.panelTarget).hidden = true;
      });
    }
  };
  
  const restoreOptionsSettings = (language) => {
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
      applySettings(language);
    }
  };
  
  const restoreEnvironmentSettings = (language) => {
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
      audioController.updateAmbient(defaults.ambientEnabled, defaults.ambientVolume);
      audioController.updateAlert({
        pomodoroEnabled: defaults.pomodoroAlertEnabled,
        breakEnabled: defaults.breakAlertEnabled,
        workSound: defaults.workAlertSound,
        breakSound: defaults.breakAlertSound,
        stopwatchEnabled: defaults.stopwatchAlertEnabled,
        tickingEnabled: defaults.tickingEnabled,
        volume: defaults.alertVolume
      });
      updateWallpaper(defaults.wallpaper);
      persist();
      applySettings(language);
    }
  };
  
  const restoreAllSettings = (language) => {
    if (window.confirm(translate(language, 'restoreAllConfirm'))) {
      const defaults = getDefaultSettings();
      state.settings = { ...defaults };
      audioController.updateAmbient(defaults.ambientEnabled, defaults.ambientVolume);
      audioController.updateAlert({
        pomodoroEnabled: defaults.pomodoroAlertEnabled,
        breakEnabled: defaults.breakAlertEnabled,
        workSound: defaults.workAlertSound,
        breakSound: defaults.breakAlertSound,
        stopwatchEnabled: defaults.stopwatchAlertEnabled,
        tickingEnabled: defaults.tickingEnabled,
        volume: defaults.alertVolume
      });
      updateWallpaper(defaults.wallpaper);
      persist();
      applySettings(language);
    }
  };
  
  return {
    applySettings,
    saveSettings,
    saveZenPomodoroSettings,
    saveZenStopwatchSettings,
    saveStopwatchSettings,
    updateWallpaper,
    updateZenMode,
    restoreOptionsSettings,
    restoreEnvironmentSettings,
    restoreAllSettings,
    resolveWallpaper,
    systemTheme
  };
};
