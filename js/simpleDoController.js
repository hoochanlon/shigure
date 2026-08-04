import { createKanbanView } from './kanban.js';

const STORAGE_KEY = 'shigure.simple-do.state';
const QUADRANTS = ['q1', 'q2', 'q3', 'q4'];
const BOARD_COLUMNS = ['pending', 'inProgress', 'completed', 'cancelled'];

const copy = {
  zh: {
    title: '待办事项', subtitle: '用四象限，决定下一步', addPlaceholder: '写下一件要做的事', add: '添加事项', completed: '已完成', history: '完成记录', clearHistory: '清空记录', clearConfirm: '确认清空全部完成事项吗？', clearQuadrant: '清空', clearQuadrantConfirm: '确认清空“{quadrant}”中的全部未完成事项吗？完成记录不会受影响。', focus: '专注', delete: '删除', move: '移至', empty: '还没有事项', emptyHistory: '还没有完成事项。', q1: '第一象限', q1Hint: '重要且紧急', q2: '第二象限', q2Hint: '重要但不紧急', q3: '第三象限', q3Hint: '紧急但不重要', q4: '第四象限', q4Hint: '不紧急也不重要'
  },
  en: {
    title: 'To-do', subtitle: 'Use four quadrants to choose what is next', addPlaceholder: 'Write down something to do', add: 'Add task', completed: 'Completed', history: 'Completed tasks', clearHistory: 'Clear history', clearConfirm: 'Clear all completed tasks?', clearQuadrant: 'Clear', clearQuadrantConfirm: 'Clear all unfinished tasks in “{quadrant}”? Completed task history will be kept.', focus: 'Focus', delete: 'Delete', move: 'Move to', empty: 'No tasks yet', emptyHistory: 'No completed tasks yet.', q1: 'Quadrant 1', q1Hint: 'Important & urgent', q2: 'Quadrant 2', q2Hint: 'Important, not urgent', q3: 'Quadrant 3', q3Hint: 'Urgent, not important', q4: 'Quadrant 4', q4Hint: 'Not urgent, not important'
  },
  ja: {
    title: 'ToDoリスト', subtitle: '4象限で次の一歩を決める', addPlaceholder: 'やることを書き出す', add: '追加', completed: '完了済み', history: '完了履歴', clearHistory: '履歴を消去', clearConfirm: '完了したすべてのタスクを削除しますか？', clearQuadrant: '削除', clearQuadrantConfirm: '「{quadrant}」の未完了タスクをすべて削除しますか？完了履歴は保持されます。', focus: '集中', delete: '削除', move: '移動先', empty: 'タスクはありません', emptyHistory: '完了したタスクはありません。', q1: '第1象限', q1Hint: '重要かつ緊急', q2: '第2象限', q2Hint: '重要・緊急ではない', q3: '第3象限', q3Hint: '緊急・重要ではない', q4: '第4象限', q4Hint: '緊急でも重要でもない'
  }
};

const text = (language, key) => (copy[language] || copy.zh)[key];
const viewCopy = {
  zh: { overview: '四象限', kanban: '看板', allItems: '全部事项', search: '搜索事项', allQuadrants: '全部象限', noMatches: '没有匹配的事项' },
  en: { overview: 'Quadrants', kanban: 'Kanban', allItems: 'All tasks', search: 'Search tasks', allQuadrants: 'All quadrants', noMatches: 'No matching tasks' },
  ja: { overview: '4象限', kanban: 'カンバン', allItems: 'すべてのタスク', search: 'タスクを検索', allQuadrants: 'すべての象限', noMatches: '一致するタスクはありません' }
};
const viewText = (language, key) => (viewCopy[language] || viewCopy.zh)[key];
const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const migrateItem = (item) => {
  const migrated = { ...item };
  if (migrated.status === 'todo') migrated.status = 'active';
  if (!migrated.boardColumn) migrated.boardColumn = migrated.status === 'completed' ? 'completed' : 'pending';
  if (typeof migrated.boardOrder !== 'number') migrated.boardOrder = 0;
  if (!migrated.createdAt) migrated.createdAt = Date.now();
  if (typeof migrated.progress !== 'number') migrated.progress = migrated.status === 'completed' ? 100 : 0;
  if (typeof migrated.notes !== 'string') migrated.notes = '';
  return migrated;
};
const isItem = (item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.title === 'string' && QUADRANTS.includes(item.quadrant) && ['active', 'completed'].includes(item.status);
const load = () => {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(state?.items) ? state.items.filter(isItem).map(migrateItem) : [];
  } catch {
    return [];
  }
};
const save = (items) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items }));

export const createSimpleDoController = ({ root, getLanguage, enhanceSelects, onFocus }) => {
  const container = root.getElementById('simple-do-view');
  let items = load();
  const language = () => getLanguage();
  const activeItems = () => items.filter((item) => item.status === 'active');
  const completedItems = () => items.filter((item) => item.status === 'completed');
  const persist = () => save(items);
  const historyPanel = root.getElementById('simple-do-history-panel');
  const historyTitle = root.getElementById('simple-do-history-title');
  const historyList = root.getElementById('simple-do-history-list');
  const exitButton = root.getElementById('simple-do-exit');
  const clearHistoryButton = root.getElementById('simple-do-clear-history');
  const historyBackdrop = root.getElementById('simple-do-history-backdrop');
  
  let kanbanController = null;
  const getQuadrantLabel = (quadrant) => text(language(), quadrant);
  const completedRecordIcon = (className) => {
    const icon = root.createElement('span');
    icon.className = className;
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path fill="currentColor" d="M8 20q-.825 0-1.412-.587T6 18v-3h3v-2.25q-.875-.05-1.662-.387T5.9 11.35v-1.1H4.75L1.5 7q.9-1.15 2.225-1.625T6.4 4.9q.675 0 1.313.1T9 5.375V4h12v13q0 1.25-.875 2.125T18 20zm3-5h6v2q0 .425.288.713T18 18t.713-.288T19 17V6h-8v.6l6 6V14h-1.4l-2.85-2.85l-.2.2q-.35.35-.737.625T11 12.4zM5.6 8.25h2.3v2.15q.3.2.625.275t.675.075q.575 0 1.038-.175t.912-.625l.2-.2l-1.4-1.4q-.725-.725-1.625-1.088T6.4 6.9q-.5 0-.95.075t-.9.225zM15 17H8v1h7.15q-.075-.225-.112-.475T15 17m-7 1v-1z"/></svg>';
    return icon;
  };
  let historyExpanded = false;
  let historyClosing = false;
  let historyModalActive = false;
  let lockedScrollY = 0;
  let viewMode = 'quadrants';
  let listFilter = 'all';
  let listQuery = '';
  const setHistoryModalActive = (active) => {
    if (active === historyModalActive) return;
    historyModalActive = active;
    root.documentElement.classList.toggle('simple-do-history-open', active);
    root.body.classList.toggle('simple-do-history-open', active);
    container.inert = active;
    exitButton.inert = active;
    if (active) {
      lockedScrollY = window.scrollY;
      root.body.style.top = `-${lockedScrollY}px`;
      return;
    }
    root.body.style.removeProperty('top');
    window.scrollTo(0, lockedScrollY);
  };
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
    move.dataset.uiSelect = '';
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
  const allItemsView = () => {
    const section = root.createElement('section');
    section.className = 'simple-do-all-view';
    const controls = root.createElement('div');
    controls.className = 'simple-do-all-controls';
    const search = root.createElement('input');
    search.type = 'search';
    search.value = listQuery;
    search.placeholder = viewText(language(), 'search');
    search.setAttribute('aria-label', viewText(language(), 'search'));
    search.dataset.action = 'search-items';
    const filter = root.createElement('select');
    filter.dataset.uiSelect = '';
    filter.dataset.action = 'filter-items';
    filter.setAttribute('aria-label', viewText(language(), 'allQuadrants'));
    [{ id: 'all', label: viewText(language(), 'allQuadrants') }, ...QUADRANTS.map((id) => ({ id, label: text(language(), id) }))].forEach(({ id, label }) => {
      const option = root.createElement('option');
      option.value = id;
      option.selected = listFilter === id;
      option.textContent = label;
      filter.append(option);
    });
    controls.append(search, filter);
    const list = root.createElement('ul');
    list.className = 'simple-do-all-list';
    const matches = activeItems().filter((item) => (listFilter === 'all' || item.quadrant === listFilter) && item.title.toLocaleLowerCase().includes(listQuery.toLocaleLowerCase()));
    if (!matches.length) {
      const empty = root.createElement('li');
      empty.className = 'simple-do-empty';
      empty.textContent = listQuery || listFilter !== 'all' ? viewText(language(), 'noMatches') : text(language(), 'empty');
      list.append(empty);
    }
    matches.forEach((item) => {
      const row = root.createElement('li');
      row.className = 'simple-do-all-item';
      const title = root.createElement('span');
      title.className = 'simple-do-all-title';
      title.textContent = item.title;
      const badge = root.createElement('span');
      badge.className = `simple-do-all-quadrant ${item.quadrant}`;
      badge.textContent = text(language(), item.quadrant);
      const move = root.createElement('select');
      move.className = 'simple-do-move';
    move.dataset.uiSelect = '';
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
      const actions = root.createElement('div');
      actions.className = 'simple-do-item-actions';
      actions.append(appendButton(text(language(), 'focus'), 'simple-do-focus', 'focus', item.id), move, appendButton(text(language(), 'delete'), 'simple-do-delete', 'delete', item.id));
      row.append(title, badge, actions);
      list.append(row);
    });
    section.append(controls, list);
    return section;
  };
  const render = () => {
    container.className = `simple-do-view${viewMode === 'all' ? ' is-all-items' : ''}${viewMode === 'kanban' ? ' is-kanban' : ''}`;
    root.body.classList.toggle('simple-do-list-mode', viewMode === 'all');
    container.replaceChildren();
    historyPanel.hidden = !historyExpanded && !historyClosing;
    historyPanel.classList.toggle('is-closing', historyClosing);
    setHistoryModalActive(historyExpanded || historyClosing);
    const heading = root.createElement('div');
    heading.className = 'simple-do-intro';
    const headingRow = root.createElement('div');
    headingRow.className = 'simple-do-intro-heading';
    const title = root.createElement('h2');
    title.textContent = text(language(), 'title');
    const historyToggle = appendButton('', 'simple-do-history-toggle', 'toggle-history');
    historyToggle.id = 'simple-do-history-toggle';
    historyToggle.append(completedRecordIcon('simple-do-history-toggle-icon'), root.createTextNode(`${text(language(), 'history')} (${completedItems().length})`));
    historyToggle.setAttribute('aria-controls', 'simple-do-history-panel');
    historyToggle.setAttribute('aria-expanded', String(historyExpanded));
    const modes = root.createElement('div');
    modes.className = 'simple-do-view-tabs';
    [['quadrants', viewText(language(), 'overview')], ['kanban', viewText(language(), 'kanban')], ['all', viewText(language(), 'allItems')]].forEach(([mode, label]) => {
      const tab = appendButton(label, 'simple-do-view-tab', 'set-view');
      tab.dataset.view = mode;
      tab.setAttribute('aria-pressed', String(viewMode === mode));
      modes.append(tab);
    });
    headingRow.append(title);
    const subtitle = root.createElement('p');
    subtitle.textContent = text(language(), 'subtitle');
    const controls = root.createElement('div');
    controls.className = 'simple-do-view-controls';
    const spacer = root.createElement('span');
    spacer.className = 'simple-do-view-controls-spacer';
    const actions = root.createElement('div');
    actions.className = 'simple-do-view-actions';
    actions.append(historyToggle, exitButton);
    controls.append(spacer, modes, actions);
    heading.append(headingRow, subtitle, controls);
    if (viewMode === 'quadrants') {
      const grid = root.createElement('div');
      grid.className = 'simple-do-grid';
      grid.append(...QUADRANTS.map(quadrant));
      container.append(heading, grid);
    } else if (viewMode === 'kanban') {
      if (!kanbanController) {
        kanbanController = createKanbanView({
          root,
          container,
          getItems: () => items,
          onMove: (itemId, newColumn, newOrder) => {
            items = items.map((item) => {
              if (item.id !== itemId) return item;
              const updated = { ...item, boardColumn: newColumn, boardOrder: newOrder };
              if (newColumn === 'completed' && item.progress < 100) updated.progress = 100;
              if (newColumn === 'completed' && item.status !== 'completed') {
                updated.status = 'completed';
                updated.completedAt = Date.now();
              }
              if (newColumn !== 'completed' && item.status === 'completed') {
                updated.status = 'active';
                updated.completedAt = null;
                if (item.progress === 100) updated.progress = 0;
              }
              return updated;
            });
            persist();
            refresh();
          },
          onUpdate: (itemId, updates) => {
            items = items.map((item) => {
              if (item.id !== itemId) return item;
              const updated = { ...item, ...updates };
              if (updates.progress === 100 && item.boardColumn !== 'completed') {
                updated.boardColumn = 'completed';
                updated.status = 'completed';
                updated.completedAt = Date.now();
              }
              return updated;
            });
            persist();
            refresh();
          },
          enhanceSelects,
          getLanguage,
          getQuadrantLabel
        });
      }
      const kanbanWrapper = root.createElement('div');
      kanbanWrapper.className = 'simple-do-kanban-view';
      kanbanController.render(kanbanWrapper);
      container.append(heading, kanbanWrapper);
    } else {
      container.append(heading, allItemsView());
    }
    enhanceSelects(container);
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
      content.className = 'simple-do-history-title';
      content.textContent = item.title;
      const metadata = root.createElement('span');
      metadata.className = 'simple-do-history-meta';
      metadata.textContent = `${text(language(), item.quadrant)} · ${new Intl.DateTimeFormat(language() === 'zh' ? 'zh-CN' : language() === 'ja' ? 'ja-JP' : 'en-US', { month: 'numeric', day: 'numeric' }).format(item.completedAt || item.createdAt)}`;
      const restore = appendButton('↺', 'simple-do-history-restore', 'restore', item.id);
      restore.setAttribute('aria-label', text(language(), 'completed'));
      const remove = appendButton(text(language(), 'delete'), 'history-delete', 'history-delete', item.id);
      row.append(completedRecordIcon('simple-do-history-icon'), content, metadata, restore, remove);
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
  const closeHistory = () => {
    if (!historyExpanded || historyClosing) return;
    historyExpanded = false;
    historyClosing = true;
    historyPanel.classList.add('is-closing');
    root.getElementById('simple-do-history-toggle')?.focus();
  };
  const toggleHistory = () => {
    if (historyExpanded || historyClosing) {
      closeHistory();
      return;
    }
    historyExpanded = true;
    historyClosing = false;
    refresh();
    historyPanel.querySelector('[role="dialog"]')?.focus();
  };
  container.addEventListener('submit', (event) => {
    const form = event.target.closest('.simple-do-add');
    if (!form) return;
    event.preventDefault();
    const title = new FormData(form).get('title').trim();
    if (!title) return;
    items = [{ id: makeId(), title, quadrant: form.dataset.quadrant, status: 'active', createdAt: Date.now(), completedAt: null, boardColumn: 'pending', boardOrder: 0, progress: 0, notes: '' }, ...items];
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
    if (target.dataset.action === 'set-view') {
      viewMode = target.dataset.view;
      render();
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
      items = items.map((current) => current.id === item.id ? { 
        ...current, 
        status: completed ? 'completed' : 'active', 
        completedAt: completed ? Date.now() : null,
        progress: completed ? 100 : (current.progress === 100 ? 0 : current.progress),
        boardColumn: completed ? 'completed' : (current.boardColumn === 'completed' ? 'pending' : current.boardColumn)
      } : current);
      persist();
      refresh();
    }
    if (target.dataset.action === 'delete') { items = items.filter((current) => current.id !== item.id); persist(); refresh(); }
    if (target.dataset.action === 'history-delete') { items = items.filter((current) => current.id !== item.id); persist(); refresh(); }
    if (target.dataset.action === 'restore') {
      items = items.map((current) => current.id === item.id ? { 
        ...current, 
        status: 'active', 
        completedAt: null,
        boardColumn: 'pending',
        progress: current.progress === 100 ? 0 : current.progress
      } : current);
      persist();
      refresh();
    }
    if (target.dataset.action === 'focus') onFocus(item.title);
  });
  container.addEventListener('input', (event) => {
    const target = event.target.closest('[data-action="search-items"]');
    if (!target) return;
    listQuery = target.value;
    render();
    const search = container.querySelector('[data-action="search-items"]');
    search?.focus();
    search?.setSelectionRange(listQuery.length, listQuery.length);
  });
  container.addEventListener('change', (event) => {
    const filter = event.target.closest('[data-action="filter-items"]');
    if (filter) {
      listFilter = filter.value;
      render();
      return;
    }
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
      items = items.map((current) => current.id === item.id ? { 
        ...current, 
        status: 'active', 
        completedAt: null,
        boardColumn: 'pending',
        progress: current.progress === 100 ? 0 : current.progress
      } : current);
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
  historyBackdrop.addEventListener('click', closeHistory);
  historyPanel.addEventListener('animationend', (event) => {
    if (!historyClosing || !event.target.matches('.simple-do-history-panel')) return;
    historyClosing = false;
    refresh();
    root.getElementById('simple-do-history-toggle')?.focus();
  });
  root.addEventListener('keydown', (event) => {
    if (!historyExpanded) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeHistory();
      return;
    }
    if (event.key !== 'Tab') return;
    const dialog = historyPanel.querySelector('[role="dialog"]');
    const focusable = [...dialog.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hidden);
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const [first] = focusable;
    const last = focusable.at(-1);
    if (event.shiftKey && root.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && root.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  return { clearHistory, render, renderHistory, resetHistoryPanel, title: () => text(language(), 'title'), subtitle: () => text(language(), 'subtitle') };
};
