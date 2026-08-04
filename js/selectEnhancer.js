const selector = 'select[data-ui-select]';

const optionLabel = (option) => option.textContent.trim();

export const createSelectEnhancer = (root = document) => {
  const instances = new Map();
  let sequence = 0;

  const positionListbox = (instance) => {
    const triggerRect = instance.trigger.getBoundingClientRect();
    const listbox = instance.listbox;
    listbox.style.position = 'fixed';
    listbox.style.left = `${triggerRect.left}px`;
    listbox.style.top = `${triggerRect.bottom + 6}px`;
    listbox.style.bottom = 'auto';
    listbox.style.width = 'max-content';
    listbox.style.minWidth = `${triggerRect.width}px`;
    listbox.style.font = window.getComputedStyle(instance.trigger).font;
    const exceedsViewport = listbox.getBoundingClientRect().bottom > window.innerHeight - 8;
    if (exceedsViewport) {
      listbox.style.top = 'auto';
      listbox.style.bottom = `${window.innerHeight - triggerRect.top + 6}px`;
    }
  };

  const close = (instance, restoreFocus = false) => {
    if (!instance || instance.listbox.hidden) return;
    instance.listbox.hidden = true;
    instance.wrapper.append(instance.listbox);
    instance.listbox.removeAttribute('style');
    instance.trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) instance.trigger.focus();
  };

  const closeAll = (except) => instances.forEach((instance) => {
    if (instance !== except) close(instance);
  });

  const sync = (instance) => {
    const options = [...instance.select.options];
    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === instance.select.value));
    const selected = options[selectedIndex];
    instance.trigger.textContent = selected ? optionLabel(selected) : '';
    instance.trigger.disabled = instance.select.disabled;
    instance.optionButtons.forEach((button, index) => {
      const isSelected = index === selectedIndex;
      button.textContent = optionLabel(options[index]);
      button.setAttribute('aria-selected', String(isSelected));
      button.tabIndex = isSelected ? 0 : -1;
      button.classList.toggle('is-selected', isSelected);
      button.disabled = options[index].disabled;
    });
    instance.activeIndex = selectedIndex;
  };

  const choose = (instance, index) => {
    const option = instance.select.options[index];
    if (!option || option.disabled) return;
    instance.select.value = option.value;
    instance.select.dispatchEvent(new Event('change', { bubbles: true }));
    sync(instance);
    close(instance, true);
  };

  const moveActive = (instance, direction) => {
    const options = [...instance.select.options];
    let index = instance.activeIndex;
    for (let offset = 1; offset <= options.length; offset += 1) {
      const candidate = (index + direction * offset + options.length) % options.length;
      if (!options[candidate].disabled) {
        instance.activeIndex = candidate;
        instance.optionButtons.forEach((button, buttonIndex) => { button.tabIndex = buttonIndex === candidate ? 0 : -1; });
        instance.optionButtons[candidate].focus();
        return;
      }
    }
  };

  const focusEdge = (instance, edge) => {
    const options = [...instance.select.options];
    const indexes = options
      .map((option, index) => option.disabled ? -1 : index)
      .filter((index) => index >= 0);
    const index = edge === 'start' ? indexes[0] : indexes.at(-1);
    if (index === undefined) return;
    instance.activeIndex = index;
    instance.optionButtons.forEach((button, buttonIndex) => { button.tabIndex = buttonIndex === index ? 0 : -1; });
    instance.optionButtons[index].focus();
  };

  const open = (instance) => {
    if (instance.trigger.disabled) return;
    closeAll(instance);
    root.body.append(instance.listbox);
    instance.listbox.hidden = false;
    positionListbox(instance);
    instance.trigger.setAttribute('aria-expanded', 'true');
    const selected = instance.optionButtons[instance.activeIndex];
    selected?.focus();
  };

  const enhance = (select) => {
    if (instances.has(select)) return instances.get(select);
    const id = select.id || `ui-select-${sequence += 1}`;
    if (!select.id) select.id = id;
    const wrapper = root.createElement('span');
    wrapper.className = 'ui-select';
    const trigger = root.createElement('button');
    trigger.type = 'button';
    trigger.className = 'ui-select-trigger';
    trigger.id = `${id}-trigger`;
    if (select.hasAttribute('aria-label')) trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const listbox = root.createElement('span');
    listbox.className = 'ui-select-listbox';
    listbox.id = `${id}-listbox`;
    listbox.setAttribute('role', 'listbox');
    listbox.setAttribute('aria-labelledby', trigger.id);
    listbox.hidden = true;
    const optionButtons = [...select.options].map((option, index) => {
      const button = root.createElement('button');
      button.type = 'button';
      button.className = 'ui-select-option';
      button.id = `${id}-option-${index}`;
      button.setAttribute('role', 'option');
      button.dataset.index = String(index);
      button.textContent = optionLabel(option);
      listbox.append(button);
      return button;
    });
    trigger.setAttribute('aria-controls', listbox.id);
    select.before(wrapper);
    wrapper.append(select, trigger, listbox);
    select.classList.add('ui-select-native');
    // 原生控件仅保存值与派发 change；Tab 焦点必须落在可见的触发器上。
    select.tabIndex = -1;
    const instance = { select, wrapper, trigger, listbox, optionButtons, activeIndex: 0 };
    instances.set(select, instance);

    trigger.addEventListener('click', () => instance.listbox.hidden ? open(instance) : close(instance));
    trigger.addEventListener('keydown', (event) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        open(instance);
        if (event.key === 'ArrowDown') moveActive(instance, 1);
        if (event.key === 'ArrowUp') moveActive(instance, -1);
      }
    });
    listbox.addEventListener('click', (event) => {
      const option = event.target.closest('.ui-select-option');
      if (option) choose(instance, Number(option.dataset.index));
    });
    listbox.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        moveActive(instance, event.key === 'ArrowDown' ? 1 : -1);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        focusEdge(instance, event.key === 'Home' ? 'start' : 'end');
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        choose(instance, instance.activeIndex);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        close(instance, true);
      } else if (event.key === 'Tab') {
        close(instance);
      }
    });
    sync(instance);
    return instance;
  };

  const pruneDisconnected = () => instances.forEach((instance, select) => {
    if (!select.isConnected) {
      instance.listbox.remove();
      instances.delete(select);
    }
  });
  const enhanceWithin = (container = root) => {
    pruneDisconnected();
    container.querySelectorAll(selector).forEach(enhance);
  };
  const refreshAll = () => {
    pruneDisconnected();
    instances.forEach(sync);
  };

  root.defaultView?.addEventListener('scroll', () => closeAll(), true);
  root.defaultView?.addEventListener('resize', () => closeAll());
  root.addEventListener('click', (event) => {
    const isInsideSelect = [...instances.values()].some(({ wrapper, listbox }) => wrapper.contains(event.target) || listbox.contains(event.target));
    if (!isInsideSelect) closeAll();
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll();
  });
  root.addEventListener('change', () => queueMicrotask(refreshAll));

  return { enhanceWithin, refreshAll };
};
