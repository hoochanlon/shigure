import { createAudioPlayer, createAudioManager, createBufferedPlayer, unlockAudio } from './audio.js';
import { saveState } from './storage.js';

/**
 * 音频控制器 - 管理所有音频播放逻辑
 */
export const createAudioController = (state, elements, view) => {
  const persist = () => saveState(state);
  const audioManager = createAudioManager();
  
  // 氛围音播放器
  let ambientPlayer = null;
  
  const syncAmbient = (options = {}) => {
    const { ambientSound, ambientVolume, ambientEnabled } = state.settings;
    const { userSwitched = false } = options;
    
    const needsNewPlayer = !ambientPlayer || ambientPlayer.source !== `./assets/audio/ambient/${ambientSound}`;
    
    if (needsNewPlayer) {
      const wasPlaying = ambientPlayer ? ambientPlayer.isPlaying() : false;
      
      if (ambientPlayer) {
        ambientPlayer.stop();
        audioManager.unregister('ambient');
      }
      
      ambientPlayer = createAudioPlayer(
        `./assets/audio/ambient/${ambientSound}`,
        { loop: true, volume: ambientVolume }
      );
      audioManager.register('ambient', ambientPlayer);
      
      if (userSwitched || wasPlaying || ambientEnabled) {
        if (userSwitched && !ambientEnabled) {
          state.settings.ambientEnabled = true;
          persist();
          setTimeout(() => {
            if (elements['rain-toggle']) {
              elements['rain-toggle'].checked = true;
            }
          }, 0);
        }
        
        unlockAudio()
          .then(() => ambientPlayer.play())
          .catch(() => {/* 静默处理 */});
      }
    } else {
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
  
  const updateAmbient = (enabled, volume = state.settings.ambientVolume, soundFile = state.settings.ambientSound) => {
    state.settings = { ...state.settings, ambientEnabled: enabled, ambientVolume: Number(volume), ambientSound: soundFile };
    persist();
    syncAmbient();
    view.renderNoise(enabled, state.settings.ambientVolume);
  };
  
  // 滴答声播放器
  const ticking = createAudioPlayer('./assets/audio/alerts/clock-stopwatch-ticking.mp3', { loop: true, volume: 0.3, maxGain: 3.0 });
  audioManager.register('ticking', ticking);
  
  // 提示音播放器
  const loadAlertPlayer = (soundFile) => createBufferedPlayer(`./assets/audio/alerts/${soundFile}`, { maxGain: 3.0, volume: state.settings.alertVolume });
  
  let workAlertPlayer = loadAlertPlayer(state.settings.workAlertSound);
  let breakAlertPlayer = loadAlertPlayer(state.settings.breakAlertSound);
  let stopwatchAlertPlayer = loadAlertPlayer('ring.mp3');
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

    if (workSound !== undefined) {
      workAlertPlayer.setSource(`./assets/audio/alerts/${workSound}`);
    }
    if (breakSound !== undefined) {
      breakAlertPlayer.setSource(`./assets/audio/alerts/${breakSound}`);
    }
    alertPlayers.forEach((player) => player.setVolume(state.settings.alertVolume));
    if (workSound !== undefined || breakSound !== undefined) {
      preloadAlertPlayers().catch(() => undefined);
    }

    if (tickingEnabled !== undefined) {
      if (tickingEnabled && (state.activeTimer?.status === 'running' || state.activeStopwatch?.status === 'running')) {
        audioManager.play('ticking');
      } else {
        audioManager.stop('ticking');
      }
    }

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
  
  // 初始化氛围音
  syncAmbient();
  
  return {
    syncAmbient,
    updateAmbient,
    playWorkAlert: () => playAlert(workAlertPlayer),
    playBreakAlert: () => playAlert(breakAlertPlayer),
    playStopwatchAlert: () => playAlert(stopwatchAlertPlayer),
    updateAlert,
    prepareAlertAudio,
    startTicking: () => audioManager.play('ticking'),
    stopTicking: () => audioManager.stop('ticking')
  };
};
