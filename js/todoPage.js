import { format, todoDictionary } from './i18n.js';

const STORAGE_KEY = 'shigure.simple-do.state';
const FOCUS_KEY = 'shigure.todo.focus-task';
const quadrants = ['q1', 'q2', 'q3', 'q4'];
const language = () => localStorage.getItem('pomodoro.timer.language') || 'zh';
const t = (key, values) => format(todoDictionary[language()][key] ?? key, values);
const locale = () => ({ zh: 'zh-CN', en: 'en-US', ja: 'ja-JP' }[language()] || 'zh-CN');
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const load = () => { try { const state = JSON.parse(localStorage.getItem(STORAGE_KEY)); return Array.isArray(state?.items) ? state.items : []; } catch { return []; } };
let items = load();
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items }));
const board = document.getElementById('todo-board');
const history = document.getElementById('todo-history');
const button = (label, action, itemId, className = '') => { const node = document.createElement('button'); node.type = 'button'; node.textContent = label; node.dataset.action = action; node.dataset.id = itemId; node.className = className; return node; };
const active = () => items.filter((item) => item.status === 'active');
const wallpaperClasses = ['has-rain-wallpaper', 'has-lofi-girl-wallpaper', 'has-dark-wallpaper'];
const syncTheme = () => {
  try {
    const savedState = JSON.parse(localStorage.getItem('pomodoro.timer.state'));
    const settings = savedState?.settings;
    const wallpaper = settings?.themeMode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : (settings?.wallpaper || 'light');
    const nextClass = wallpaper === 'rain' ? 'has-rain-wallpaper' : wallpaper === 'lofi-girl' ? 'has-lofi-girl-wallpaper' : wallpaper === 'dark' ? 'has-dark-wallpaper' : null;
    [document.documentElement, document.body].forEach((element) => {
      wallpaperClasses.forEach((className) => element.classList.toggle(className, className === nextClass));
    });
  } catch { /* Keep the base theme when persisted settings are unavailable. */ }
};

const createQuadrantSelector = (item) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'todo-quadrant-selector';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'todo-quadrant-trigger';
  trigger.dataset.id = item.id;
  trigger.textContent = t(item.quadrant);
  const dropdown = document.createElement('div');
  dropdown.className = 'todo-quadrant-dropdown';
  dropdown.hidden = true;
  quadrants.forEach((q) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'todo-quadrant-option';
    option.dataset.action = 'move';
    option.dataset.id = item.id;
    option.dataset.quadrant = q;
    option.textContent = t(q);
    if (q === item.quadrant) option.classList.add('active');
    dropdown.append(option);
  });
  wrapper.append(trigger, dropdown);
  return wrapper;
};
const renderBoard = () => {
  board.replaceChildren();
  quadrants.forEach((quadrant) => {
    const section = document.createElement('section'); 
    section.className = `todo-quadrant ${quadrant}`;
    const entries = active().filter((item) => item.quadrant === quadrant);
    const heading = document.createElement('div'); 
    heading.className = 'todo-quadrant-heading';
    const copy = document.createElement('div'); 
    const title = document.createElement('h2'); 
    title.textContent = t(quadrant); 
    const hint = document.createElement('p'); 
    hint.textContent = t(`${quadrant}Hint`); 
    copy.append(title, hint);
    const count = document.createElement('span'); 
    count.className = 'todo-count'; 
    count.textContent = entries.length; 
    heading.append(copy, count);
    const list = document.createElement('ul'); 
    list.className = 'todo-list';
    entries.forEach((item) => { 
      const row = document.createElement('li'); 
      row.className = 'todo-item'; 
      const check = button('', 'complete', item.id, 'todo-check'); 
      check.setAttribute('aria-label', item.title); 
      const title = document.createElement('span'); 
      title.className = 'todo-item-title'; 
      title.textContent = item.title; 
      const actions = document.createElement('div'); 
      actions.className = 'todo-actions'; 
      const selector = createQuadrantSelector(item);
      actions.append(button(t('focus'), 'focus', item.id, 'todo-focus'), selector, button(t('delete'), 'delete', item.id, 'todo-delete')); 
      row.append(check, title, actions); 
      list.append(row); 
    });
    if (!entries.length) { 
      const empty = document.createElement('li'); 
      empty.className = 'todo-empty'; 
      empty.textContent = t('empty'); 
      list.append(empty); 
    }
    const form = document.createElement('form'); 
    form.className = 'todo-add'; 
    form.dataset.quadrant = quadrant; 
    const input = document.createElement('input'); 
    input.name = 'title'; 
    input.required = true; 
    input.maxLength = 100; 
    input.placeholder = t('placeholder'); 
    const submit = document.createElement('button'); 
    submit.textContent = `+ ${t('add')}`; 
    form.append(input, submit); 
    section.append(heading, list, form); 
    board.append(section);
  });
};
const renderHistory = () => { history.replaceChildren(); const header = document.createElement('div'); header.className = 'todo-history-header'; const title = document.createElement('h2'); title.textContent = t('history'); const clear = button(t('clear'), 'clear'); clear.className = 'todo-history-clear'; header.append(title, clear); const list = document.createElement('ul'); list.className = 'todo-history-list'; const completed = items.filter((item) => item.status === 'completed'); if (!completed.length) { const empty = document.createElement('li'); empty.textContent = t('emptyHistory'); list.append(empty); } completed.forEach((item) => { const row = document.createElement('li'); const name = document.createElement('span'); name.textContent = item.title; const meta = document.createElement('span'); meta.className = 'todo-history-meta'; const completedAt = new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(item.completedAt || item.createdAt); meta.textContent = t('completedAt', { date: completedAt }); row.append(name, meta, button(t('restore'), 'restore', item.id), button(t('delete'), 'delete', item.id)); list.append(row); }); history.append(header, list); };
const languageToggle = document.getElementById('todo-language-toggle');
const languageDropdown = document.getElementById('todo-language-dropdown');
const render = () => { document.documentElement.lang = locale(); document.title = `${t('title')} · Shigure`; document.getElementById('todo-title').textContent = t('title'); document.getElementById('back-label').textContent = t('back'); document.getElementById('todo-subtitle').textContent = t('subtitle'); document.getElementById('todo-history-label').textContent = t('history'); document.querySelectorAll('.language-option').forEach((option) => option.classList.toggle('active', option.dataset.lang === language())); renderBoard(); if (!history.hidden) renderHistory(); };
board.addEventListener('submit', (event) => { 
  const form = event.target.closest('.todo-add'); 
  if (!form) return; 
  event.preventDefault(); 
  const title = new FormData(form).get('title').trim(); 
  if (!title) return; 
  items = [{ id: id(), title, quadrant: form.dataset.quadrant, status: 'active', createdAt: Date.now() }, ...items]; 
  save(); 
  render(); 
});

board.addEventListener('click', (event) => {
  const trigger = event.target.closest('.todo-quadrant-trigger');
  if (trigger) {
    const wrapper = trigger.parentElement;
    const dropdown = wrapper.querySelector('.todo-quadrant-dropdown');
    const isOpening = dropdown.hidden;
    document.querySelectorAll('.todo-quadrant-dropdown').forEach(d => d.hidden = true);
    dropdown.hidden = !isOpening;
    return;
  }
});

document.addEventListener('click', (event) => { 
  const target = event.target.closest('[data-action]'); 
  if (!target) {
    if (event.target.closest('.todo-quadrant-selector')) return;
    document.querySelectorAll('.todo-quadrant-dropdown').forEach(d => d.hidden = true);
    return;
  }
  
  const item = items.find((entry) => entry.id === target.dataset.id); 
  if (target.dataset.action === 'clear') { 
    items = items.filter((entry) => entry.status !== 'completed'); 
    save(); 
    renderHistory(); 
    return; 
  } 
  if (!item) return; 
  
  if (target.dataset.action === 'complete') {
    items = items.map((entry) => entry.id === item.id ? { ...entry, status: 'completed', completedAt: Date.now() } : entry);
  }
  if (target.dataset.action === 'restore') {
    items = items.map((entry) => entry.id === item.id ? { ...entry, status: 'active', completedAt: null } : entry);
  }
  if (target.dataset.action === 'delete') {
    items = items.filter((entry) => entry.id !== item.id);
  }
  if (target.dataset.action === 'move') {
    items = items.map((entry) => entry.id === item.id ? { ...entry, quadrant: target.dataset.quadrant } : entry);
    document.querySelectorAll('.todo-quadrant-dropdown').forEach(d => d.hidden = true);
  }
  if (target.dataset.action === 'focus') { 
    localStorage.setItem(FOCUS_KEY, item.title); 
    window.location.href = './index.html';
    return; 
  } 
  save(); 
  render(); 
});
document.getElementById('todo-history-toggle').addEventListener('click', () => { history.hidden = !history.hidden; if (!history.hidden) renderHistory(); });
languageToggle.addEventListener('click', () => { const opening = languageDropdown.hidden; languageDropdown.hidden = !opening; languageToggle.setAttribute('aria-expanded', String(opening)); });
document.querySelectorAll('.language-option').forEach((option) => option.addEventListener('click', () => { localStorage.setItem('pomodoro.timer.language', option.dataset.lang); languageDropdown.hidden = true; languageToggle.setAttribute('aria-expanded', 'false'); render(); }));
document.addEventListener('click', (event) => { if (event.target.closest('.language-selector')) return; languageDropdown.hidden = true; languageToggle.setAttribute('aria-expanded', 'false'); });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);
syncTheme();
render();
