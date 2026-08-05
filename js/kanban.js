const COLUMNS = ['pending', 'inProgress', 'completed', 'cancelled'];

const defaultCopy = {
  zh: { pending: '待处理', inProgress: '进行中', completed: '已完成', cancelled: '已取消', details: '事项详情', title: '标题', quadrant: '象限', boardColumn: '看板区', progress: '项目进度', autoSave: '自动保存', notes: '备注（Markdown）', preview: '内容预览', save: '保存', close: '关闭', move: '移动到', dragHint: '拖动卡片调整顺序', empty: '暂无事项' },
  en: { pending: 'Pending', inProgress: 'In progress', completed: 'Completed', cancelled: 'Cancelled', details: 'Task details', title: 'Title', quadrant: 'Quadrant', boardColumn: 'Board column', progress: 'Progress', autoSave: 'Auto-save', notes: 'Notes (Markdown)', preview: 'Content preview', save: 'Save', close: 'Close', move: 'Move to', dragHint: 'Drag cards to reorder', empty: 'No tasks' },
  ja: { pending: '保留中', inProgress: '進行中', completed: '完了', cancelled: 'キャンセル', details: 'タスク詳細', title: 'タイトル', quadrant: '象限', boardColumn: 'ボード列', progress: '進捗', autoSave: '自動保存', notes: 'メモ（Markdown）', preview: '内容プレビュー', save: '保存', close: '閉じる', move: '移動先', dragHint: 'カードをドラッグして並べ替え', empty: 'タスクはありません' }
};


export const createKanbanView = ({ root, container, getItems, onMove, onUpdate, enhanceSelects, getLanguage, getQuadrantLabel }) => {
  let renderContainer = container;
  let drag = null;
  let dragFrame = 0;
  let suppressClick = false;
  const raf = (callback) => root.defaultView.requestAnimationFrame(callback);
  const cancelRaf = (frame) => root.defaultView.cancelAnimationFrame(frame);
  const copy = (key) => (defaultCopy[getLanguage()] || defaultCopy.zh)[key];
  const columnLabel = (id) => copy(id);
  const orderedItems = (column) => getItems().filter((item) => item.boardColumn === column && (item.status === 'active' || column === 'completed'))
    .sort((a, b) => a.boardOrder - b.boardOrder || a.createdAt - b.createdAt);

  let activeEditor = null;
  let detailsModalActive = false;
  let lockedScrollY = 0;
  const setDetailsModalActive = (active) => {
    if (active === detailsModalActive) return;
    detailsModalActive = active;
    root.documentElement.classList.toggle('kanban-details-open', active);
    root.body.classList.toggle('kanban-details-open', active);
    renderContainer.inert = active;
    if (active) {
      lockedScrollY = root.defaultView.scrollY;
      root.body.style.top = `-${lockedScrollY}px`;
      return;
    }
    root.body.style.removeProperty('top');
    root.defaultView.scrollTo(0, lockedScrollY);
  };
  const closeDetails = ({ animate = true } = {}) => {
    const dialog = root.querySelector('.kanban-details');
    if (!dialog) return;
    const removeDialog = () => {
      dialog.remove();
      setDetailsModalActive(false);
    };
    dialog.flushAutoSave?.();
    activeEditor?.destroy();
    activeEditor = null;
    if (!animate) {
      removeDialog();
      return;
    }
    dialog.classList.add('is-closing');
    const panel = dialog.querySelector('.kanban-details-panel');
    panel?.addEventListener('animationend', (event) => {
      if (event.target === panel) removeDialog();
    });
  };
  const createNotesEditor = (host, initialValue, onSave, onAutoSaveToggle) => {
    const Vditor = root.defaultView.Vditor;
    if (!Vditor) {
      const fallback = root.createElement('textarea');
      fallback.name = 'notes'; fallback.rows = 10; fallback.value = initialValue;
      host.append(fallback);
      return { getMarkdown: () => fallback.value, destroy: () => {} };
    }
    const editor = new Vditor(host, {
      mode: 'ir',
      height: '100%',
      value: initialValue,
      cache: { enable: false },
      toolbar: ['headings', 'bold', 'italic', 'strike', '|', 'list', 'ordered-list', 'check', '|', 'quote', 'code', 'link', '|', 'undo', 'redo', 'fullscreen', { name: 'save-details', icon: '<svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5V4Zm2 2v5h8V6H7Zm0 9v3h10v-3H7Zm9-9.2V9h1.2L16 7.8V6h0Z" fill="currentColor"/></svg>', tip: copy('save'), tipPosition: 'ne', click: onSave }, { name: 'toggle-auto-save', className: 'kanban-details-auto-save is-active', icon: '<svg viewBox="0 0 24 24"><path d="m9 16.2-3.5-3.5L4.1 14.1 9 19l11-11-1.4-1.4z" fill="currentColor"/></svg>', tip: copy('autoSave'), tipPosition: 'ne', click: onAutoSaveToggle }],
      lang: ({ zh: 'zh_CN', ja: 'ja_JP', en: 'en_US' }[getLanguage()] || 'zh_CN'),
      cdn: 'https://cdn.jsdelivr.net/npm/vditor@3.11.2'
    });
    return { getMarkdown: () => editor.getValue(), destroy: () => editor.destroy() };
  };
  const openDetails = (item) => {
    closeDetails({ animate: false });
    const dialog = root.createElement('div');
    dialog.className = 'kanban-details';
    dialog.innerHTML = `<div class="kanban-details-backdrop" data-kanban-action="close-details"></div><section class="kanban-details-panel" role="dialog" aria-modal="true" aria-labelledby="kanban-details-title" tabindex="-1"><header><h2 id="kanban-details-title">${copy('details')}</h2><button type="button" class="kanban-details-close" data-kanban-action="close-details" aria-label="${copy('close')}">×</button></header><form class="kanban-details-form"><label>${copy('title')}<input name="title" maxlength="100" required></label><label>${copy('quadrant')}<select name="quadrant" data-ui-select></select></label><label>${copy('boardColumn')}<select name="boardColumn" data-ui-select></select></label><label>${copy('progress')}<div class="kanban-progress-editor"><input name="progress" type="range" min="0" max="100" step="1"><output></output></div></label><div class="kanban-details-editor-label">${copy('notes')}</div><div class="kanban-details-editor" aria-label="${copy('notes')}"></div></form></section></div>`;
    const form = dialog.querySelector('form');
    form.elements.title.value = item.title;
    form.elements.progress.value = item.progress || 0;
    form.elements.progress.nextElementSibling.value = `${form.elements.progress.value}%`;
    form.elements.progress.addEventListener('input', () => { form.elements.progress.nextElementSibling.value = `${form.elements.progress.value}%`; });
    ['q1', 'q2', 'q3', 'q4'].forEach((quadrant) => form.elements.quadrant.append(new Option(getQuadrantLabel(quadrant), quadrant, false, item.quadrant === quadrant)));
    COLUMNS.forEach((column) => form.elements.boardColumn.append(new Option(columnLabel(column), column, false, item.boardColumn === column)));
    root.body.append(dialog);
    setDetailsModalActive(true);
    enhanceSelects?.(dialog);
    const collectUpdates = () => ({ title: form.elements.title.value.trim(), quadrant: form.elements.quadrant.value, boardColumn: form.elements.boardColumn.value, progress: Number(form.elements.progress.value), notes: activeEditor.getMarkdown() });
    let autoSave = true;
    let autoSaveTimer = 0;
    const scheduleAutoSave = () => {
      root.defaultView.clearTimeout(autoSaveTimer);
      if (!autoSave) return;
      autoSaveTimer = root.defaultView.setTimeout(() => onUpdate(item.id, collectUpdates(), { refresh: false }), 500);
    };
    activeEditor = createNotesEditor(
      dialog.querySelector('.kanban-details-editor'),
      item.notes || '',
      () => form.requestSubmit(),
      (event) => {
        autoSave = !autoSave;
        const toggle = event.currentTarget.closest('.vditor-toolbar__item') || autoSaveButton();
        toggle?.classList.toggle('is-active', autoSave);
        if (!autoSave) root.defaultView.clearTimeout(autoSaveTimer);
      }
    );
    const autoSaveButton = () => dialog.querySelector('[data-type="toggle-auto-save"], .kanban-details-auto-save');
    root.defaultView.setTimeout(() => autoSaveButton()?.classList.add('is-active'), 0);
    dialog.flushAutoSave = () => {
      root.defaultView.clearTimeout(autoSaveTimer);
      if (autoSave) onUpdate(item.id, collectUpdates(), { refresh: false });
    };
    form.addEventListener('input', scheduleAutoSave);
    form.addEventListener('change', scheduleAutoSave);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      dialog.flushAutoSave = null;
      onUpdate(item.id, collectUpdates());
      closeDetails();
    });
    dialog.addEventListener('click', (event) => { if (event.target.closest('[data-kanban-action="close-details"]')) closeDetails(); });
    form.elements.title.focus();
  };
  const card = (item) => {
    const element = root.createElement('article');
    element.className = 'kanban-card'; element.dataset.itemId = item.id; element.tabIndex = 0;
    const title = root.createElement('div'); title.className = 'kanban-card-title'; title.textContent = item.title;
    const badge = root.createElement('span'); badge.className = `kanban-card-quadrant ${item.quadrant}`; badge.textContent = getQuadrantLabel(item.quadrant);
    const progress = root.createElement('div'); progress.className = 'kanban-card-progress'; progress.innerHTML = `<span></span><output></output>`; progress.querySelector('span').style.width = `${item.progress || 0}%`; progress.querySelector('output').textContent = `${item.progress || 0}%`;
    const actions = root.createElement('div'); actions.className = 'kanban-card-actions';
    const details = root.createElement('button'); details.type = 'button'; details.className = 'kanban-card-details'; details.textContent = copy('details'); details.dataset.kanbanAction = 'details';
    const move = root.createElement('select'); move.className = 'kanban-card-move'; move.dataset.kanbanAction = 'move'; move.dataset.uiSelect = ''; move.setAttribute('aria-label', copy('move'));
    COLUMNS.forEach((column) => move.append(new Option(columnLabel(column), column, false, item.boardColumn === column)));
    actions.append(details, move); element.append(title, badge, progress, actions); return element;
  };
  const render = (target = container) => {
    renderContainer = target; renderContainer.replaceChildren();
    const board = root.createElement('div'); board.className = 'kanban-board'; board.setAttribute('aria-label', copy('dragHint'));
    COLUMNS.forEach((column) => {
      const section = root.createElement('section'); section.className = `kanban-column ${column}`;
      const heading = root.createElement('header'); heading.className = 'kanban-column-heading';
      const headingText = root.createElement('div'); const title = root.createElement('h2'); title.textContent = columnLabel(column); const hint = root.createElement('p'); hint.textContent = copy('dragHint'); headingText.append(title, hint);
      const count = root.createElement('span'); count.className = 'kanban-column-count'; count.textContent = orderedItems(column).length; heading.append(headingText, count);
      const list = root.createElement('div'); list.className = 'kanban-column-list'; list.dataset.boardColumn = column;
      const items = orderedItems(column); if (items.length) list.append(...items.map(card)); else { const empty = root.createElement('p'); empty.className = 'kanban-column-empty'; empty.textContent = copy('empty'); list.append(empty); }
      section.append(heading, list); board.append(section);
    });
    renderContainer.append(board);
  };
  const scheduleDrag = (event) => {
    if (!drag) return;
    drag.x = event.clientX; drag.y = event.clientY; drag.moved = true;
    if (dragFrame) return;
    dragFrame = raf(() => {
      dragFrame = 0; if (!drag) return;
      drag.card.style.transform = `translate3d(${drag.x - drag.startX}px, ${drag.y - drag.startY}px, 0)`;
      const target = root.elementFromPoint(drag.x, drag.y)?.closest('.kanban-card, .kanban-column-list');
      const list = target?.matches('.kanban-column-list') ? target : target?.closest('.kanban-column-list');
      if (!list) return;
      const cards = [...list.querySelectorAll('.kanban-card:not(.is-dragging)')];
      const before = cards.find((candidate) => drag.y < candidate.getBoundingClientRect().top + candidate.offsetHeight / 2);
      if (before) list.insertBefore(drag.placeholder, before); else list.append(drag.placeholder);
    });
  };
  const finishDrag = () => {
    if (!drag) return;
    if (dragFrame) cancelRaf(dragFrame);
    const list = drag.placeholder.parentElement; const column = list?.dataset.boardColumn;
    const order = list ? [...list.children].indexOf(drag.placeholder) : 0;
    drag.card.style.transform = ''; drag.card.style.left = ''; drag.card.style.top = ''; drag.card.style.width = ''; drag.card.classList.remove('is-dragging'); drag.placeholder.replaceWith(drag.card);
    if (drag.moved && column) { suppressClick = true; onMove(drag.card.dataset.itemId, column, order); root.defaultView.setTimeout(() => { suppressClick = false; }, 0); }
    drag = null; dragFrame = 0;
  };
  container.addEventListener('pointerdown', (event) => {
    const cardElement = event.target.closest('.kanban-card'); if (!cardElement || event.target.closest('button, select')) return;
    const placeholder = root.createElement('div'); placeholder.className = 'kanban-card-placeholder'; placeholder.style.height = `${cardElement.offsetHeight}px`;
    const bounds = cardElement.getBoundingClientRect();
    cardElement.before(placeholder); cardElement.style.left = `${bounds.left}px`; cardElement.style.top = `${bounds.top}px`; cardElement.style.width = `${bounds.width}px`;
    drag = { card: cardElement, placeholder, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false }; cardElement.classList.add('is-dragging'); cardElement.setPointerCapture?.(event.pointerId);
  });
  container.addEventListener('pointermove', scheduleDrag); container.addEventListener('pointerup', finishDrag); container.addEventListener('pointercancel', finishDrag);
  container.addEventListener('click', (event) => {
    const cardElement = event.target.closest('.kanban-card'); if (!cardElement || suppressClick || event.target.closest('select, .ui-select-trigger')) return;
    const item = getItems().find(({ id }) => id === cardElement.dataset.itemId); if (item) openDetails(item);
  });
  container.addEventListener('change', (event) => {
    const select = event.target.closest('[data-kanban-action="move"]'); if (!select) return;
    const cardElement = select.closest('.kanban-card'); const item = getItems().find(({ id }) => id === cardElement.dataset.itemId);
    if (item) onMove(item.id, select.value, orderedItems(select.value).length);
  });
  root.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDetails(); });
  return { render, renderInto: render };
};
