import { saveState } from './storage.js';

/**
 * 会话管理器 - 管理历史记录
 */
export const createSessionManager = (state, view, language, elements) => {
  const persist = () => saveState(state);
  
  const record = (session) => {
    state.sessions.unshift(session);
    state.sessions = state.sessions.slice(0, 100);
    persist();
    view.renderHistory(state.sessions, language, deleteHistoryItem);
    
    if (!elements['zen-history-panel'].hidden) {
      view.renderZenHistory(state.sessions, language, deleteHistoryItem);
    }
    
    const currentMode = document.getElementById('tab-stopwatch').classList.contains('active') 
      ? 'stopwatch' 
      : 'pomodoro';
    view.updateStatsDisplay(currentMode, state.sessions, language, state.settings.stopwatchTimeFormat);
  };
  
  const deleteHistoryItem = (index) => {
    state.sessions.splice(index, 1);
    persist();
    view.renderHistory(state.sessions, language, deleteHistoryItem);
    
    if (!elements['zen-history-panel'].hidden) {
      view.renderZenHistory(state.sessions, language, deleteHistoryItem);
    }
    
    const currentMode = document.getElementById('tab-stopwatch').classList.contains('active') 
      ? 'stopwatch' 
      : 'pomodoro';
    view.updateStatsDisplay(currentMode, state.sessions, language, state.settings.stopwatchTimeFormat);
  };
  
  const clearHistory = () => {
    state.sessions = [];
    persist();
    view.renderHistory([], language, deleteHistoryItem);
    
    if (!elements['zen-history-panel'].hidden) {
      view.renderZenHistory([], language, deleteHistoryItem);
    }
  };
  
  return {
    record,
    deleteHistoryItem,
    clearHistory
  };
};
