import { createAudioPlayer, createAudioManager, createBufferedPlayer, unlockAudio } from './audio.js';
import { saveState } from './storage.js';

export const createAudioController = ({ state, elements, view, isTickingActive }) => {
  const audioManager = createAudioManager();
  const persist = () => saveState(state);
  let ambientPlayer = null;
  let previewPlayer = null;

  const syncAmbient = ({ userSwitched = false } = {}) => {
    const { ambientSound, ambientVolume, ambientEnabled } = state.settings;
    const source = `./assets/audio/ambient/${ambientSound}`;
    const needsReplacement = !ambientPlayer || ambientPlayer.source !== source;

    if (needsReplacement) {
      const wasPlaying = ambientPlayer?.isPlaying() ?? false;
      audioManager.unregister('ambient');
      ambientPlayer = createAudioPlayer(source, { loop: true, volume: ambientVolume });
      audioManager.register('ambient', ambientPlayer);
      if (userSwitched && !ambientEnabled) {
        state.settings.ambientEnabled = true;
        persist();
        elements['rain-toggle'].checked = true;
      }
      if (userSwitched || wasPlaying || state.settings.ambientEnabled) {
        unlockAudio().then(() => ambientPlayer.play()).catch(() => undefined);
      }
      return;
    }

    ambientPlayer.setVolume(ambientVolume);
    if (ambientEnabled && !ambientPlayer.isPlaying()) {
      unlockAudio().then(() => ambientPlayer.play()).catch(() => undefined);
    } else if (!ambientEnabled && ambientPlayer.isPlaying()) {
      ambientPlayer.stop();
    }
  };

  const updateAmbient = (enabled, volume = state.settings.ambientVolume, sound = state.settings.ambientSound) => {
    state.settings = { ...state.settings, ambientEnabled: enabled, ambientVolume: Number(volume), ambientSound: sound };
    persist();
    syncAmbient();
    view.renderNoise(enabled, state.settings.ambientVolume);
  };

  const ticking = createAudioPlayer('./assets/audio/alerts/clock-stopwatch-ticking.mp3', { loop: true, volume: 0.3, maxGain: 3 });
  audioManager.register('ticking', ticking);
  const alertPlayers = [
    createBufferedPlayer(`./assets/audio/alerts/${state.settings.workAlertSound}`, { maxGain: 3, volume: state.settings.alertVolume }),
    createBufferedPlayer(`./assets/audio/alerts/${state.settings.breakAlertSound}`, { maxGain: 3, volume: state.settings.alertVolume }),
    createBufferedPlayer('./assets/audio/alerts/ring.mp3', { maxGain: 3, volume: state.settings.alertVolume })
  ];
  const [workAlertPlayer, breakAlertPlayer, stopwatchAlertPlayer] = alertPlayers;
  const preloadAlertPlayers = () => Promise.all(alertPlayers.map((player) => player.preload()));
  const playAlert = (player) => player.play().catch(() => undefined);
  const prepareAlertAudio = () => {
    unlockAudio().catch(() => undefined);
    preloadAlertPlayers().catch(() => undefined);
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
      alertVolume: volume === undefined ? state.settings.alertVolume : Number(volume)
    };
    if (workSound !== undefined) workAlertPlayer.setSource(`./assets/audio/alerts/${workSound}`);
    if (breakSound !== undefined) breakAlertPlayer.setSource(`./assets/audio/alerts/${breakSound}`);
    alertPlayers.forEach((player) => player.setVolume(state.settings.alertVolume));
    if (workSound !== undefined || breakSound !== undefined) preloadAlertPlayers().catch(() => undefined);
    if (tickingEnabled !== undefined) isTickingActive() ? audioManager.play('ticking') : audioManager.stop('ticking');
    persist();
    view.renderAlert(
      state.settings.pomodoroAlertEnabled,
      state.settings.breakAlertEnabled,
      state.settings.workAlertSound,
      state.settings.breakAlertSound,
      state.settings.stopwatchAlertEnabled,
      state.settings.tickingEnabled,
      state.settings.alertVolume
    );
  };

  const stopPreview = () => {
    previewPlayer?.stop();
    previewPlayer?.dispose();
    previewPlayer = null;
  };
  const preview = ({ ambientSound, alertSound }) => {
    stopPreview();
    previewPlayer = ambientSound
      ? createAudioPlayer(`./assets/audio/ambient/${ambientSound}`, { loop: true, volume: state.settings.ambientVolume })
      : createAudioPlayer(`./assets/audio/alerts/${alertSound}`, { maxGain: 3, volume: state.settings.alertVolume });
    return previewPlayer.play();
  };
  const dispose = () => {
    stopPreview();
    audioManager.disposeAll();
    alertPlayers.forEach((player) => player.dispose());
    ambientPlayer = null;
  };

  syncAmbient();
  return {
    syncAmbient,
    updateAmbient,
    updateAlert,
    prepareAlertAudio,
    playWorkAlert: () => playAlert(workAlertPlayer),
    playBreakAlert: () => playAlert(breakAlertPlayer),
    playStopwatchAlert: () => playAlert(stopwatchAlertPlayer),
    startTicking: () => audioManager.play('ticking'),
    stopTicking: () => audioManager.stop('ticking'),
    stopPreview,
    preview,
    dispose
  };
};
