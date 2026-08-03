import { saveState } from './storage.js';

export const createSessionManager = (state, view, getLanguage, elements, getMode) => {
  const persist = () => saveState(state);
  const render = () => {
    const language = getLanguage();
    view.renderHistory(state.sessions, language, deleteHistoryItem);
    if (!elements['zen-history-panel'].hidden) view.renderZenHistory(state.sessions, language, deleteHistoryItem);
    view.updateStatsDisplay(getMode(), state.sessions, language, state.settings.stopwatchTimeFormat);
  };

  const record = (session) => {
    state.sessions = [session, ...state.sessions].slice(0, 100);
    persist();
    render();
  };

  const deleteHistoryItem = (index) => {
    state.sessions.splice(index, 1);
    persist();
    render();
  };

  const clearHistory = () => {
    state.sessions = [];
    persist();
    render();
  };

  return { record, deleteHistoryItem, clearHistory, render };
};
