import { saveState, getDefaultSettings } from './storage.js';
import { translate, translateCompact } from './i18n.js';
import { parseTimeInput } from './timeParser.js';

/**
 * 设置控制器 - 管理所有设置相关逻辑
 */
export const createSettingsController = (state, view, elements, audioController, onWallpaperChange = () => {}) => {
  const persist = () => saveState(state);
  
  // 工具函数
  const getMinutes = (element) => Number(element.value);
  const getSeconds = (element) => {
    const input = element.value.trim();
    const parsed = parseTimeInput(input);
    return parsed !== null ? parsed : Number(input);
  };
  const isValidMinutes = (value) => (value === 0 || (Number.isFinite(value) && value > 0 && value <= 99));
  const normalizePomodoroMinutes = (value, fallback) => isValidMinutes(value) && value > 0 ? value : fallback;
  const normalizeStopwatchAutoStopSeconds = (value) => Number.isInteger(value) && value >= 0 && value <= 359_999 ? value : 0;
  
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const resolveWallpaper = () => state.settings.themeMode === 'system' 
    ? (systemTheme.matches ? 'dark' : 'light') 
    : state.settings.wallpaper;
  
  const applySettings = (language) => {
    const defaults = getDefaultSettings();
    const displayConfiguredValue = (value, fallback) => value === 0 || value === fallback ? '' : value;
    elements['work-minutes'].value = displayConfiguredValue(state.settings.workMinutes, defaults.workMinutes);
    elements['break-minutes'].value = displayConfiguredValue(state.settings.breakMinutes, defaults.breakMinutes);
    elements['cycle-mode'].value = state.settings.cycleMode;
    elements['stopwatch-auto-stop'].value = state.settings.stopwatchAutoStopSeconds || '';
    elements['stopwatch-time-format'].value = state.settings.stopwatchTimeFormat || 'compact';
    elements['zen-work-minutes'].value = displayConfiguredValue(state.settings.workMinutes, defaults.workMinutes);
    elements['zen-break-minutes'].value = displayConfiguredValue(state.settings.breakMinutes, defaults.breakMinutes);
    elements['zen-cycle-mode'].value = state.settings.cycleMode;
    elements['zen-stopwatch-auto-stop'].value = state.settings.stopwatchAutoStopSeconds || '';
    elements['zen-stopwatch-time-format'].value = state.settings.stopwatchTimeFormat || 'compact';
    
    // 应用氛围音设置
    if (elements['ambient-sound']) {
      elements['ambient-sound'].value = state.settings.ambientSound || 'rain.mp3';
      const selectedOption = document.querySelector(`#ambient-sound-dropdown [data-value="${state.settings.ambientSound || 'rain.mp3'}"]`);
      if (selectedOption && elements['ambient-sound-label']) {
        const labelKey = selectedOption.dataset.labelKey;
        const fullLabel = translate(language, labelKey);
        elements['ambient-sound-label'].textContent = translateCompact(language, labelKey);
        elements['ambient-sound-label'].dataset.i18n = labelKey;
        elements['ambient-sound-label'].title = fullLabel;
        elements['ambient-sound-label'].closest('.custom-select-trigger')?.setAttribute('aria-label', fullLabel);
      }
    }
    
    view.renderNoise(state.settings.ambientEnabled, state.settings.ambientVolume);
    view.renderAlert(
      state.settings.pomodoroAlertEnabled,
      state.settings.breakAlertEnabled,
      state.settings.workAlertSound,
      state.settings.breakAlertSound,
      state.settings.stopwatchAlertEnabled,
      state.settings.alertVolume
    );
    onWallpaperChange();
    elements['zen-toggle'].checked = state.settings.zenMode;
    document.documentElement.classList.remove('zen-mode-preload');
    document.body.classList.toggle('zen-mode', state.settings.zenMode);
    elements['zen-settings'].hidden = !state.settings.zenMode;
  };
  
  const saveSettings = (language) => {
    const defaults = getDefaultSettings();
    const workMinutes = normalizePomodoroMinutes(getMinutes(elements['work-minutes']), defaults.workMinutes);
    const breakMinutes = normalizePomodoroMinutes(getMinutes(elements['break-minutes']), defaults.breakMinutes);
    
    state.settings = { ...state.settings, workMinutes, breakMinutes, cycleMode: elements['cycle-mode'].value };
    persist();
    applySettings(language);
    return true;
  };
  
  const saveZenPomodoroSettings = (language) => {
    const defaults = getDefaultSettings();
    const workMinutes = normalizePomodoroMinutes(getMinutes(elements['zen-work-minutes']), defaults.workMinutes);
    const breakMinutes = normalizePomodoroMinutes(getMinutes(elements['zen-break-minutes']), defaults.breakMinutes);
    
    state.settings = { ...state.settings, workMinutes, breakMinutes, cycleMode: elements['zen-cycle-mode'].value };
    persist();
    applySettings(language);
    return true;
  };
  
  const saveZenStopwatchSettings = (language) => {
    const stopwatchAutoStopSeconds = normalizeStopwatchAutoStopSeconds(getSeconds(elements['zen-stopwatch-auto-stop']));
    
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
    const stopwatchAutoStopSeconds = normalizeStopwatchAutoStopSeconds(getSeconds(elements['stopwatch-auto-stop']));
    
    state.settings = { 
      ...state.settings, 
      stopwatchAutoStopSeconds, 
      stopwatchTimeFormat: elements['stopwatch-time-format'].value 
    };
    persist();
    applySettings(language);
    
    const currentMode = document.getElementById('tab-stopwatch').classList.contains('active') 
      ? 'stopwatch' 
      : 'pomodoro';
    view.updateStatsDisplay(currentMode, state.sessions, language, state.settings.stopwatchTimeFormat);
    return true;
  };
  
  const updateWallpaper = (wallpaper) => {
    state.settings = { ...state.settings, wallpaper, themeMode: 'manual' };
    persist();
    onWallpaperChange();
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
