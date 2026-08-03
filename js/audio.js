// Web Audio API 音频管理器，支持增强音量和多音频源
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioContext.createGain();
masterGain.connect(audioContext.destination);

export const unlockAudio = () => audioContext.state === 'running' ? Promise.resolve() : audioContext.resume();

// 音频源缓存
const audioBufferCache = new Map();

// 预加载音频文件
const loadAudioBuffer = async (url) => {
  if (audioBufferCache.has(url)) {
    return audioBufferCache.get(url);
  }
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    audioBufferCache.set(url, audioBuffer);
    return audioBuffer;
  } catch (error) {
    console.error('Failed to load audio:', url, error);
    return null;
  }
};

// 创建支持增强音量的音频播放器
export const createAudioPlayer = (source, { loop = false, volume = 1, maxGain = 2.0 } = {}) => {
  const audio = new Audio(source);
  audio.preload = 'auto';
  audio.loop = loop;
  audio.addEventListener('ended', () => {
    if (loop) {
      audio.currentTime = 0;
      audio.play().catch(() => undefined);
    }
  });
  
  // 创建 MediaElementSource 和 GainNode
  let mediaSource = null;
  let gainNode = null;
  let isConnected = false;
  let disposed = false;
  
  const setupWebAudio = () => {
    if (!isConnected && !disposed) {
      try {
        mediaSource = audioContext.createMediaElementSource(audio);
        gainNode = audioContext.createGain();
        gainNode.gain.value = Math.min(volume * maxGain, maxGain);
        mediaSource.connect(gainNode);
        gainNode.connect(masterGain);
        isConnected = true;
      } catch (e) {
        // 如果 Web Audio 失败，回退到普通模式
        audio.volume = Math.min(volume, 1);
      }
    }
  };
  
  return {
    play: async () => {
      if (disposed) return undefined;
      audio.loop = loop;
      setupWebAudio();
      await unlockAudio();
      return audio.play().catch(() => undefined);
    },
    stop: () => { 
      audio.pause(); 
      audio.currentTime = 0; 
    },
    setVolume: (value) => {
      const clampedValue = Math.max(0, Math.min(1, value));
      if (gainNode) {
        gainNode.gain.value = clampedValue * maxGain;
      } else {
        audio.volume = clampedValue;
      }
    },
    isPlaying: () => {
      return !disposed && !audio.paused && audio.currentTime > 0 && !audio.ended;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      mediaSource?.disconnect();
      gainNode?.disconnect();
      mediaSource = null;
      gainNode = null;
      isConnected = false;
    },
    get volume() { 
      return gainNode ? gainNode.gain.value / maxGain : audio.volume; 
    },
    get source() {
      return source;
    }
  };
};

export const createBufferedPlayer = (source, { volume = 1, maxGain = 2.0 } = {}) => {
  let currentSource = source;
  let currentVolume = volume;
  let bufferPromise = loadAudioBuffer(source);
  let disposed = false;
  const activeSources = new Map();

  const releaseSource = (sourceNode) => {
    const gainNode = activeSources.get(sourceNode);
    sourceNode.disconnect();
    gainNode?.disconnect();
    activeSources.delete(sourceNode);
  };

  const stop = () => {
    activeSources.forEach((_, sourceNode) => {
      try { sourceNode.stop(); } catch { /* Source may already have ended. */ }
      releaseSource(sourceNode);
    });
  };

  return {
    preload: () => bufferPromise,
    play: async () => {
      if (disposed) return false;
      try {
        const buffer = await bufferPromise;
        if (!buffer) return false;
        if (audioContext.state !== 'running') {
          console.warn('Alert sound skipped because the audio context is not running.');
          return false;
        }
        const sourceNode = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        sourceNode.buffer = buffer;
        gainNode.gain.value = Math.min(currentVolume * maxGain, maxGain);
        sourceNode.connect(gainNode);
        gainNode.connect(masterGain);
        sourceNode.addEventListener('ended', () => releaseSource(sourceNode), { once: true });
        activeSources.set(sourceNode, gainNode);
        sourceNode.start(0);
        return true;
      } catch (error) {
        console.error('Failed to play alert sound:', currentSource, error);
        return false;
      }
    },
    stop,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      stop();
    },
    setSource: (nextSource) => {
      if (nextSource === currentSource) return;
      stop();
      currentSource = nextSource;
      bufferPromise = loadAudioBuffer(nextSource);
    },
    setVolume: (nextVolume) => {
      currentVolume = Math.max(0, Math.min(1, Number(nextVolume)));
    }
  };
};

// 创建单次播放的音频（用于提示音）
export const createOneTimePlayer = async (source, volume = 1, maxGain = 2.0) => {
  const buffer = await loadAudioBuffer(source);
  if (!buffer) return null;
  
  return {
    play: async () => {
      await unlockAudio();
      const sourceNode = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      
      sourceNode.buffer = buffer;
      gainNode.gain.value = Math.min(volume * maxGain, maxGain);
      
      sourceNode.connect(gainNode);
      gainNode.connect(masterGain);
      sourceNode.start(0);
      
      return new Promise((resolve) => {
        sourceNode.onended = resolve;
      });
    }
  };
};

// 音频管理器：统一管理多个音频源
export const createAudioManager = () => {
  const players = new Map();
  
  return {
    // 注册音频播放器
    register: (key, player) => {
      players.set(key, player);
    },
    
    // 注销指定音频，避免已替换的播放器继续被管理器持有
    unregister: (key) => {
      players.get(key)?.dispose?.();
      players.delete(key);
    },
    
    // 播放指定音频
    play: (key) => {
      const player = players.get(key);
      if (player) {
        return player.play();
      }
    },
    
    // 停止指定音频
    stop: (key) => {
      const player = players.get(key);
      if (player) {
        player.stop();
      }
    },
    
    // 设置音量
    setVolume: (key, volume) => {
      const player = players.get(key);
      if (player) {
        player.setVolume(volume);
      }
    },
    
    // 停止所有音频
    stopAll: () => {
      players.forEach(player => player.stop());
    },
    disposeAll: () => {
      players.forEach(player => player.dispose?.());
      players.clear();
    }
  };
};
