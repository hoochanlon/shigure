import { translate } from './i18n.js';
import { getDefaultSettings } from './storage.js';

export const createEventBinder = ({ state, elements, view, getLanguage, setLanguage, getMode, switchMode, timer, stopwatch, settings, sessions, audio, wallpaper, persist, render }) => {
  const removers = [];
  const listen = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  };
  const language = () => getLanguage();
  const closePanels = () => document.querySelectorAll('[data-panel-target]').forEach((button) => {
    button.setAttribute('aria-expanded', 'false');
    const panel = document.getElementById(button.dataset.panelTarget);
    if (panel) panel.hidden = true;
  });
  const togglePanel = (button) => {
    const panel = document.getElementById(button.dataset.panelTarget);
    if (!panel) return;
    const opening = button.getAttribute('aria-expanded') !== 'true';
    closePanels();
    button.setAttribute('aria-expanded', String(opening));
    panel.hidden = !opening;
  };
  const closeRestorePanel = () => {
    const panel = document.getElementById('restore-panel');
    const button = document.querySelector('[data-panel-target="restore-panel"]');
    if (panel) panel.hidden = true;
    button?.setAttribute('aria-expanded', 'false');
  };
  const renderStats = () => view.updateStatsDisplay(getMode(), state.sessions, language(), state.settings.stopwatchTimeFormat);

  listen(elements['start-work'], 'click', () => {
    if (!settings.saveSettings(language())) return;
    audio.prepareAlertAudio();
    timer.start({ task: elements['task-name'].value.trim(), mode: 'work', minutes: state.settings.workMinutes });
  });
  listen(elements['start-break'], 'click', () => {
    if (!settings.saveSettings(language())) return;
    audio.prepareAlertAudio();
    timer.start({ task: translate(language(), 'breakTask'), mode: 'break', minutes: state.settings.breakMinutes });
  });
  listen(elements['pause-resume'], 'click', () => timer.state.status === 'running' ? timer.pause() : timer.resume());
  listen(elements['stop-timer'], 'click', () => {
    const session = timer.stop();
    if (session) sessions.record(session);
  });
  listen(elements['reset-timer'], 'click', () => {
    if (!window.confirm(translate(language(), 'resetPomodoroConfirm'))) return;
    timer.reset();
    state.pomodoroResetAt = Date.now();
    persist();
    sessions.render();
  });

  listen(elements['stopwatch-start'], 'click', () => {
    if (!settings.saveStopwatchSettings(language())) return;
    audio.prepareAlertAudio();
    stopwatch.start();
  });
  listen(elements['stopwatch-stop'], 'click', () => stopwatch.stop());
  listen(elements['stopwatch-complete'], 'click', () => {
    const session = stopwatch.complete(document.getElementById('stopwatch-task-name').value.trim());
    if (session) {
      sessions.record(session);
      if (state.settings.stopwatchAlertEnabled) audio.playStopwatchAlert();
    }
  });
  listen(elements['stopwatch-reset'], 'click', () => stopwatch.reset());
  listen(document.getElementById('tab-pomodoro'), 'click', () => switchMode('pomodoro'));
  listen(document.getElementById('tab-stopwatch'), 'click', () => switchMode('stopwatch'));

  ['work-minutes', 'break-minutes', 'cycle-mode'].forEach((id) => listen(elements[id], 'change', () => {
    if (settings.saveSettings(language())) render();
  }));
  listen(elements['stopwatch-auto-stop'], 'change', () => settings.saveStopwatchSettings(language()));
  listen(elements['stopwatch-time-format'], 'change', () => settings.saveStopwatchSettings(language()));
  ['zen-work-minutes', 'zen-break-minutes', 'zen-cycle-mode'].forEach((id) => listen(elements[id], 'change', () => {
    if (settings.saveZenPomodoroSettings(language())) render();
  }));
  ['zen-stopwatch-auto-stop', 'zen-stopwatch-time-format'].forEach((id) => listen(elements[id], 'change', () => settings.saveZenStopwatchSettings(language())));

  listen(elements['rain-toggle'], 'change', () => audio.updateAmbient(elements['rain-toggle'].checked));
  listen(elements['rain-volume'], 'input', () => audio.updateAmbient(elements['rain-toggle'].checked, elements['rain-volume'].value));
  ['light', 'dark', 'rain', 'lofi-girl'].forEach((wallpaperName) => listen(elements[`wallpaper-${wallpaperName}`], 'click', () => {
    settings.updateWallpaper(wallpaperName);
    wallpaper.resetPerformanceSignal();
  }));
  listen(elements['zen-toggle'], 'change', () => settings.updateZenMode(elements['zen-toggle'].checked));
  listen(elements['zen-exit'], 'click', () => {
    elements['zen-toggle'].checked = false;
    settings.updateZenMode(false);
  });
  listen(elements['pomodoro-alert-toggle'], 'change', () => audio.updateAlert({ pomodoroEnabled: elements['pomodoro-alert-toggle'].checked }));
  listen(elements['break-alert-toggle'], 'change', () => audio.updateAlert({ breakEnabled: elements['break-alert-toggle'].checked }));
  listen(elements['stopwatch-alert-toggle'], 'change', () => audio.updateAlert({ stopwatchEnabled: elements['stopwatch-alert-toggle'].checked }));
  listen(elements['ticking-toggle'], 'change', () => audio.updateAlert({ tickingEnabled: elements['ticking-toggle'].checked }));
  listen(elements['alert-volume'], 'input', () => audio.updateAlert({ volume: elements['alert-volume'].value }));

  listen(elements['clear-history'], 'click', () => {
    if (window.confirm(translate(language(), 'clearConfirm'))) sessions.clearHistory();
  });
  listen(elements['zen-clear-history'], 'click', () => {
    if (window.confirm(translate(language(), 'clearConfirm'))) sessions.clearHistory();
  });
  listen(elements['zen-settings-toggle'], 'click', () => {
    elements['zen-history-panel'].hidden = true;
    elements['zen-settings-panel'].hidden = !elements['zen-settings-panel'].hidden;
  });
  listen(elements['zen-history-toggle'], 'click', () => {
    elements['zen-settings-panel'].hidden = true;
    elements['zen-history-panel'].hidden = !elements['zen-history-panel'].hidden;
    if (!elements['zen-history-panel'].hidden) sessions.render();
  });
  listen(elements['zen-restore-settings'], 'click', () => {
    if (!window.confirm(translate(language(), 'restoreAllConfirm'))) return;
    const defaults = getDefaultSettings();
    state.settings = { ...defaults };
    audio.updateAmbient(defaults.ambientEnabled, defaults.ambientVolume);
    audio.updateAlert({ pomodoroEnabled: defaults.pomodoroAlertEnabled, breakEnabled: defaults.breakAlertEnabled, workSound: defaults.workAlertSound, breakSound: defaults.breakAlertSound, stopwatchEnabled: defaults.stopwatchAlertEnabled, tickingEnabled: defaults.tickingEnabled, volume: defaults.alertVolume });
    settings.updateWallpaper(defaults.wallpaper);
    persist();
    settings.applySettings(language());
    render();
    closePanels();
  });
  listen(document.getElementById('restore-options-main'), 'click', () => {
    closeRestorePanel();
    settings.restoreOptionsSettings(language());
    render();
  });
  listen(document.getElementById('restore-environment-main'), 'click', () => {
    closeRestorePanel();
    settings.restoreEnvironmentSettings(language());
  });

  const languageDropdown = document.getElementById('language-dropdown');
  listen(elements['language-toggle'], 'click', () => {
    const opening = languageDropdown.hidden;
    document.querySelectorAll('.language-dropdown').forEach((dropdown) => { dropdown.hidden = true; });
    languageDropdown.hidden = !opening;
    elements['language-toggle'].setAttribute('aria-expanded', String(opening));
  });
  document.querySelectorAll('.language-option').forEach((option) => listen(option, 'click', () => {
    setLanguage(option.dataset.lang);
    languageDropdown.hidden = true;
    elements['language-toggle'].setAttribute('aria-expanded', 'false');
    render();
  }));

  document.querySelectorAll('[data-panel-target]').forEach((button) => listen(button, 'click', (event) => {
    event.stopPropagation();
    togglePanel(button);
  }));

  const soundSelectors = ['work', 'break'].map((mode) => ({
    mode,
    trigger: document.getElementById(`pomodoro-${mode}-sound-trigger`),
    dropdown: document.getElementById(`pomodoro-${mode}-sound-dropdown`),
    input: document.getElementById(`pomodoro-${mode}-alert-sound`)
  }));
  const closeSoundSelectors = () => soundSelectors.forEach(({ trigger, dropdown }) => {
    if (!trigger || !dropdown) return;
    dropdown.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  });
  soundSelectors.forEach(({ mode, trigger, dropdown, input }) => {
    listen(trigger, 'click', () => {
      const opening = dropdown.hidden;
      closeSoundSelectors();
      dropdown.hidden = !opening;
      trigger.setAttribute('aria-expanded', String(opening));
    });
    dropdown?.querySelectorAll('.custom-select-option').forEach((option) => listen(option, 'click', (event) => {
      if (event.target.closest('.option-preview-btn')) return;
      input.value = option.dataset.value;
      audio.stopPreview();
      audio.updateAlert(mode === 'work' ? { workSound: option.dataset.value } : { breakSound: option.dataset.value });
      closeSoundSelectors();
    }));
  });
  const ambient = { trigger: elements['ambient-sound-trigger'], dropdown: document.getElementById('ambient-sound-dropdown'), input: elements['ambient-sound'], label: elements['ambient-sound-label'] };
  listen(ambient.trigger, 'click', () => {
    const opening = ambient.dropdown.hidden;
    closeSoundSelectors();
    ambient.dropdown.hidden = !opening;
    ambient.trigger.setAttribute('aria-expanded', String(opening));
  });
  ambient.dropdown?.querySelectorAll('.custom-select-option').forEach((option) => listen(option, 'click', (event) => {
    if (event.target.closest('.option-preview-btn')) return;
    const sound = option.dataset.value;
    ambient.input.value = sound;
    ambient.label.textContent = translate(language(), option.dataset.labelKey);
    ambient.label.dataset.i18n = option.dataset.labelKey;
    state.settings = { ...state.settings, ambientSound: sound };
    persist();
    audio.syncAmbient({ userSwitched: true });
    ambient.dropdown.hidden = true;
    ambient.trigger.setAttribute('aria-expanded', 'false');
  }));
  document.querySelectorAll('.option-preview-btn').forEach((button) => listen(button, 'click', (event) => {
    event.stopPropagation();
    audio.preview({ ambientSound: button.dataset.ambientSound, alertSound: button.dataset.sound });
  }));

  listen(document, 'click', (event) => {
    if (!event.target.closest('.language-selector')) {
      languageDropdown.hidden = true;
      elements['language-toggle'].setAttribute('aria-expanded', 'false');
    }
    if (!event.target.closest('.custom-select-wrapper')) {
      closeSoundSelectors();
      if (ambient.dropdown) ambient.dropdown.hidden = true;
      ambient.trigger?.setAttribute('aria-expanded', 'false');
      audio.stopPreview();
    }
    if (!event.target.closest('#zen-settings')) {
      elements['zen-settings-panel'].hidden = true;
      elements['zen-history-panel'].hidden = true;
    }
    if (!event.target.closest('[data-panel-target="restore-panel"]') && !event.target.closest('#restore-panel')) closeRestorePanel();
  });

  return { dispose: () => removers.splice(0).forEach((remove) => remove()) };
};
