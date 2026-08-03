const STORAGE_KEY = 'shigure.simple-do.state';
const QUADRANTS = ['q1', 'q2', 'q3', 'q4'];

const copy = {
  zh: {
    title: '待办事项', subtitle: '用四象限，决定下一步', addPlaceholder: '写下一件要做的事', add: '添加事项', completed: '已完成', history: '完成记录', clearHistory: '清空完成记录', clearConfirm: '确认清空全部完成事项吗？', clearQuadrant: '清空', clearQuadrantConfirm: '确认清空“{quadrant}”中的全部未完成事项吗？完成记录不会受影响。', focus: '专注', delete: '删除', move: '移至', empty: '还没有事项', emptyHistory: '还没有完成事项。', q1: '第一象限', q1Hint: '重要且紧急', q2: '第二象限', q2Hint: '重要但不紧急', q3: '第三象限', q3Hint: '紧急但不重要', q4: '第四象限', q4Hint: '不紧急也不重要'
  },
  en: {
    title: 'To-do', subtitle: 'Use four quadrants to choose what is next', addPlaceholder: 'Write down something to do', add: 'Add task', completed: 'Completed', history: 'Completed tasks', clearHistory: 'Clear completed tasks', clearConfirm: 'Clear all completed tasks?', clearQuadrant: 'Clear', clearQuadrantConfirm: 'Clear all unfinished tasks in “{quadrant}”? Completed task history will be kept.', focus: 'Focus', delete: 'Delete', move: 'Move to', empty: 'No tasks yet', emptyHistory: 'No completed tasks yet.', q1: 'Quadrant 1', q1Hint: 'Important & urgent', q2: 'Quadrant 2', q2Hint: 'Important, not urgent', q3: 'Quadrant 3', q3Hint: 'Urgent, not important', q4: 'Quadrant 4', q4Hint: 'Not urgent, not important'
  },
  ja: {
    title: 'ToDoリスト', subtitle: '4象限で次の一歩を決める', addPlaceholder: 'やることを書き出す', add: '追加', completed: '完了済み', history: '完了履歴', clearHistory: '完了済みを削除', clearConfirm: '完了したすべてのタスクを削除しますか？', clearQuadrant: '削除', clearQuadrantConfirm: '「{quadrant}」の未完了タスクをすべて削除しますか？完了履歴は保持されます。', focus: '集中', delete: '削除', move: '移動先', empty: 'タスクはありません', emptyHistory: '完了したタスクはありません。', q1: '第1象限', q1Hint: '重要かつ緊急', q2: '第2象限', q2Hint: '重要・緊急ではない', q3: '第3象限', q3Hint: '緊急・重要ではない', q4: '第4象限', q4Hint: '緊急でも重要でもない'
  }
};

const text = (language, key) => (copy[language] || copy.zh)[key];
const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const isItem = (item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.title === 'string' && QUADRANTS.includes(item.quadrant) && ['active', 'completed'].includes(item.status);
const load = () => {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(state?.items) ? state.items.filter(isItem) : [];
  } catch {
    return [];
  }
};
const save = (items) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items }));

export const createSimpleDoController = ({ root, getLanguage, onFocus }) => {
  const container = root.getElementById('simple-do-view');
  let items = load();
  const language = () => getLanguage();
  const activeItems = () => items.filter((item) => item.status === 'active');
  const completedItems = () => items.filter((item) => item.status === 'completed');
  const persist = () => save(items);
  const historyPanel = root.getElementById('simple-do-history-panel');
  const historyTitle = root.getElementById('simple-do-history-title');
  const historyList = root.getElementById('simple-do-history-list');
  const clearHistoryButton = root.getElementById('simple-do-clear-history');
  let historyExpanded = false;
  const appendButton = (label, className, action, value) => {
    const button = root.createElement('button');
    button.type = 'button';
    button.className = className;
    button.dataset.action = action;
    if (value) button.dataset.id = value;
    button.textContent = label;
    return button;
  };
  const renderItem = (item) => {
    const row = root.createElement('li');
    row.className = `simple-do-item ${item.status}`;
    const complete = appendButton(item.status === 'completed' ? '✓' : '', 'simple-do-check', 'toggle', item.id);
    complete.setAttribute('aria-label', item.status === 'completed' ? text(language(), 'completed') : item.title);
    complete.setAttribute('aria-pressed', String(item.status === 'completed'));
    const title = root.createElement('span');
    title.className = 'simple-do-item-title';
    title.textContent = item.title;
    const actions = root.createElement('div');
    actions.className = 'simple-do-item-actions';
    if (item.status === 'active') actions.append(appendButton(text(language(), 'focus'), 'simple-do-focus', 'focus', item.id));
    const move = root.createElement('select');
    move.className = 'simple-do-move';
    move.dataset.action = 'move';
    move.dataset.id = item.id;
    move.setAttribute('aria-label', text(language(), 'move'));
    QUADRANTS.forEach((quadrant) => {
      const option = root.createElement('option');
      option.value = quadrant;
      option.selected = item.quadrant === quadrant;
      option.textContent = text(language(), quadrant);
      move.append(option);
    });
    actions.append(move, appendButton(text(language(), 'delete'), 'simple-do-delete', 'delete', item.id));
    row.append(complete, title, actions);
    return row;
  };
  const quadrant = (id) => {
    const panel = root.createElement('section');
    panel.className = `simple-do-quadrant ${id}`;
    const heading = root.createElement('div');
    heading.className = 'simple-do-heading';
    const label = root.createElement('div');
    const title = root.createElement('h2');
    title.textContent = text(language(), id);
    const hint = root.createElement('p');
    hint.textContent = text(language(), `${id}Hint`);
    label.append(title, hint);
    const quadrantItems = activeItems().filter((item) => item.quadrant === id);
    const headingActions = root.createElement('div');
    headingActions.className = 'simple-do-heading-actions';
    const count = root.createElement('span');
    count.className = 'simple-do-count';
    count.textContent = quadrantItems.length;
    const clear = appendButton(text(language(), 'clearQuadrant'), 'simple-do-clear-quadrant', 'clear-quadrant');
    clear.dataset.quadrant = id;
    clear.disabled = !quadrantItems.length;
    headingActions.append(count, clear);
    heading.append(label, headingActions);
    const list = root.createElement('ul');
    list.className = 'simple-do-list';
    if (quadrantItems.length) list.append(...quadrantItems.map(renderItem));
    else {
      const empty = root.createElement('li');
      empty.className = 'simple-do-empty';
      empty.textContent = text(language(), 'empty');
      list.append(empty);
    }
    const form = root.createElement('form');
    form.className = 'simple-do-add';
    form.dataset.quadrant = id;
    const input = root.createElement('input');
    input.name = 'title';
    input.maxLength = 100;
    input.required = true;
    input.placeholder = text(language(), 'addPlaceholder');
    input.setAttribute('aria-label', text(language(), 'addPlaceholder'));
    const submit = root.createElement('button');
    submit.type = 'submit';
    submit.textContent = `+ ${text(language(), 'add')}`;
    form.append(input, submit);
    panel.append(heading, list, form);
    return panel;
  };
  const render = () => {
    container.replaceChildren();
    historyPanel.hidden = !historyExpanded;
    const heading = root.createElement('div');
    heading.className = 'simple-do-intro';
    const headingRow = root.createElement('div');
    headingRow.className = 'simple-do-intro-heading';
    const title = root.createElement('h2');
    title.textContent = text(language(), 'title');
    const historyToggle = appendButton(`${text(language(), 'history')} (${completedItems().length})`, 'simple-do-history-toggle', 'toggle-history');
    historyToggle.setAttribute('aria-controls', 'simple-do-history-panel');
    historyToggle.setAttribute('aria-expanded', String(historyExpanded));
    headingRow.append(title, historyToggle);
    const subtitle = root.createElement('p');
    subtitle.textContent = text(language(), 'subtitle');
    heading.append(headingRow, subtitle);
    const grid = root.createElement('div');
    grid.className = 'simple-do-grid';
    grid.append(...QUADRANTS.map(quadrant));
    container.append(heading, grid);
  };
  const renderHistory = () => {
    historyTitle.textContent = text(language(), 'history');
    clearHistoryButton.textContent = text(language(), 'clearHistory');
    historyList.replaceChildren();
    const completed = completedItems();
    clearHistoryButton.disabled = !completed.length;
    if (!completed.length) {
      const empty = root.createElement('li');
      empty.textContent = text(language(), 'emptyHistory');
      historyList.append(empty);
      return;
    }
    completed.forEach((item) => {
      const row = root.createElement('li');
      row.className = 'simple-do-history-item';
      const content = root.createElement('span');
      content.textContent = item.title;
      const metadata = root.createElement('span');
      metadata.className = 'simple-do-history-meta';
      metadata.textContent = `${text(language(), item.quadrant)} · ${new Intl.DateTimeFormat(language() === 'zh' ? 'zh-CN' : language() === 'ja' ? 'ja-JP' : 'en-US', { month: 'numeric', day: 'numeric' }).format(item.completedAt || item.createdAt)}`;
      const restore = appendButton('↺', 'simple-do-history-restore', 'restore', item.id);
      restore.setAttribute('aria-label', text(language(), 'completed'));
      const remove = appendButton(text(language(), 'delete'), 'history-delete', 'history-delete', item.id);
      row.append(content, metadata, restore, remove);
      historyList.append(row);
    });
  };
  const resetHistoryPanel = () => {
    historyTitle.textContent = text(language(), 'history');
    clearHistoryButton.textContent = text(language(), 'clearHistory');
  };
  const refresh = () => {
    render();
    renderHistory();
  };
  const clearQuadrant = (id) => {
    const hasActiveItems = items.some((item) => item.status === 'active' && item.quadrant === id);
    if (!hasActiveItems) return;
    const message = text(language(), 'clearQuadrantConfirm').replace('{quadrant}', text(language(), id));
    if (!window.confirm(message)) return;
    items = items.filter((item) => item.status !== 'active' || item.quadrant !== id);
    persist();
    refresh();
  };
  const toggleHistory = () => {
    historyExpanded = !historyExpanded;
    refresh();
  };
  container.addEventListener('submit', (event) => {
    const form = event.target.closest('.simple-do-add');
    if (!form) return;
    event.preventDefault();
    const title = new FormData(form).get('title').trim();
    if (!title) return;
    items = [{ id: makeId(), title, quadrant: form.dataset.quadrant, status: 'active', createdAt: Date.now(), completedAt: null }, ...items];
    persist();
    refresh();
  });
  container.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    if (target.dataset.action === 'toggle-history') {
      toggleHistory();
      return;
    }
    if (target.dataset.action === 'clear-quadrant') {
      clearQuadrant(target.dataset.quadrant);
      return;
    }
    const item = items.find(({ id }) => id === target.dataset.id);
    if (!item) return;
    if (target.dataset.action === 'toggle') {
      const completed = item.status !== 'completed';
      items = items.map((current) => current.id === item.id ? { ...current, status: completed ? 'completed' : 'active', completedAt: completed ? Date.now() : null } : current);
      persist();
      refresh();
    }
    if (target.dataset.action === 'delete') { items = items.filter((current) => current.id !== item.id); persist(); refresh(); }
    if (target.dataset.action === 'history-delete') { items = items.filter((current) => current.id !== item.id); persist(); refresh(); }
    if (target.dataset.action === 'restore') { items = items.map((current) => current.id === item.id ? { ...current, status: 'active', completedAt: null } : current); persist(); refresh(); }
    if (target.dataset.action === 'focus') onFocus(item.title);
  });
  container.addEventListener('change', (event) => {
    const target = event.target.closest('[data-action="move"]');
    if (!target || !QUADRANTS.includes(target.value)) return;
    items = items.map((item) => item.id === target.dataset.id ? { ...item, quadrant: target.value } : item);
    persist();
    refresh();
  });
  historyList.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    const item = items.find(({ id }) => id === target?.dataset.id);
    if (!item) return;
    if (target.dataset.action === 'history-delete') {
      items = items.filter((current) => current.id !== item.id);
    }
    if (target.dataset.action === 'restore') {
      items = items.map((current) => current.id === item.id ? { ...current, status: 'active', completedAt: null } : current);
    }
    persist();
    refresh();
  });
  const clearHistory = () => {
    if (!window.confirm(text(language(), 'clearConfirm'))) return;
    items = items.filter((item) => item.status !== 'completed');
    persist();
    refresh();
  };
  clearHistoryButton.addEventListener('click', clearHistory);
  return { clearHistory, render, renderHistory, resetHistoryPanel, title: () => text(language(), 'title'), subtitle: () => text(language(), 'subtitle') };
};
