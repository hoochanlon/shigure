export const createWallpaperController = ({ state, view }) => {
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let monitorId = null;
  let windowStartedAt = 0;
  let frameCount = 0;
  let lowFrameWindows = 0;

  const resolveWallpaper = () => state.settings.themeMode === 'system'
    ? (systemTheme.matches ? 'dark' : 'light')
    : state.settings.wallpaper;

  const stopMonitor = () => {
    if (monitorId !== null) window.cancelAnimationFrame(monitorId);
    monitorId = null;
    windowStartedAt = 0;
    frameCount = 0;
  };

  const sync = () => {
    const isLofi = resolveWallpaper() === 'lofi-girl';
    const useStatic = isLofi && (reducedMotion.matches || document.visibilityState !== 'visible' || lowFrameWindows >= 2);
    document.documentElement.classList.toggle('use-static-lofi-wallpaper', useStatic);
    stopMonitor();
    if (isLofi && !useStatic) monitorId = window.requestAnimationFrame(monitor);
  };

  const monitor = (timestamp) => {
    if (resolveWallpaper() !== 'lofi-girl' || document.visibilityState !== 'visible' || reducedMotion.matches) return sync();
    if (!windowStartedAt) windowStartedAt = timestamp;
    frameCount += 1;
    const elapsed = timestamp - windowStartedAt;
    if (elapsed >= 5_000) {
      lowFrameWindows = frameCount / (elapsed / 1_000) < 30 ? lowFrameWindows + 1 : 0;
      windowStartedAt = timestamp;
      frameCount = 0;
      if (lowFrameWindows >= 2) return sync();
    }
    monitorId = window.requestAnimationFrame(monitor);
  };

  const render = () => {
    view.renderWallpaper(resolveWallpaper(), state.settings.themeMode);
    sync();
  };

  const resetPerformanceSignal = () => {
    lowFrameWindows = 0;
    sync();
  };

  return {
    systemTheme,
    reducedMotion,
    resolveWallpaper,
    render,
    sync,
    resetPerformanceSignal,
    dispose: stopMonitor
  };
};
