export const createAudioPlayer = (source, { loop = false, volume = 1 } = {}) => {
  const audio = new Audio(source);
  audio.preload = 'auto';
  audio.loop = loop;
  audio.volume = volume;
  return {
    play: () => audio.play().catch(() => undefined),
    stop: () => { audio.pause(); audio.currentTime = 0; },
    setVolume: (value) => { audio.volume = Math.max(0, Math.min(1, value)); },
    get volume() { return audio.volume; }
  };
};
