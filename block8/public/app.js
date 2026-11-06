/* Progressive enhancement only: navigation and writes remain native HTML requests. */
(() => {
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const timers = new Set();
  const later = fn => { const id = setTimeout(() => { timers.delete(id); fn(); }, 300); timers.add(id); return id; };
  const cancel = id => { clearTimeout(id); timers.delete(id); };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const book = document.querySelector('.menu-book');
  const pagination = document.querySelector('[data-pagination]');
  const busy = url => {
    if (!book) return;
    const target = new URL(url, location.href);
    book.dataset.direction = Number(target.searchParams.get('page') || 1) < Number(pagination?.dataset.page || 1) ? 'back' : 'forward';
    book.classList.add('departing');
    book.setAttribute('aria-busy', 'true');
  };
  document.querySelectorAll('[data-list-form]').forEach(form => {
    let timer, composing = false;
    const valid = () => {
      const low = form.elements.namedItem('minPrice'), high = form.elements.namedItem('maxPrice');
      if (high) high.setCustomValidity(low.value && high.value && Number(low.value) > Number(high.value) ? 'Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu.' : '');
      return form.checkValidity();
    };
    const submit = () => { cancel(timer); if (!composing && valid()) form.requestSubmit(); };
    form.addEventListener('input', event => {
      valid();
      if (event.target.matches('[data-debounce]')) { cancel(timer); if (!composing) timer = later(submit); }
    });
    form.addEventListener('compositionstart', () => { composing = true; cancel(timer); });
    form.addEventListener('compositionend', () => { composing = false; timer = later(submit); });
    form.addEventListener('change', event => { if (event.target.matches('select')) submit(); });
    form.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !composing && !event.isComposing && event.target.matches('input')) { event.preventDefault(); submit(); }
    });
    form.addEventListener('submit', event => {
      cancel(timer);
      if (!valid()) { event.preventDefault(); form.reportValidity(); return; }
      busy(form.action);
    });
  });
  document.querySelectorAll('[data-picker]').forEach(fieldset => {
    const tools = fieldset.querySelector('.picker-tools'), footer = fieldset.querySelector('.picker-footer');
    const search = tools.querySelector('input'), chips = tools.querySelector('ul');
    const root = fieldset.querySelector('.options-scroll'), labels = [...root.querySelectorAll('.checkbox-option')];
    const more = footer.querySelector('button'), count = footer.querySelector('p');
    let term = '', limit = 6, timer, composing = false, matches = labels;
    tools.hidden = footer.hidden = false;
    const render = () => {
      matches = labels.filter(label => normalize(label.querySelector('span').firstChild.textContent).includes(normalize(term)));
      const shown = new Set(matches.slice(0, limit));
      labels.forEach(label => { label.hidden = !shown.has(label); });
      more.hidden = limit >= matches.length;
      count.textContent = `Hiển thị ${Math.min(limit, matches.length)} / ${matches.length} mục`;
      chips.replaceChildren();
      labels.filter(label => label.querySelector('input').checked).forEach(label => {
        const li = document.createElement('li'), text = document.createElement('span'), button = document.createElement('button');
        text.textContent = label.querySelector('span').firstChild.textContent;
        button.type = 'button'; button.textContent = '×'; button.setAttribute('aria-label', 'Bỏ chọn ' + text.textContent);
        button.addEventListener('click', () => { label.querySelector('input').checked = false; render(); });
        li.append(text, button); chips.append(li);
      });
    };
    const apply = () => { cancel(timer); term = search.value.trim(); limit = 6; root.scrollTop = 0; render(); };
    search.addEventListener('input', () => { cancel(timer); if (!composing) timer = later(apply); });
    search.addEventListener('compositionstart', () => { composing = true; cancel(timer); });
    search.addEventListener('compositionend', () => { composing = false; timer = later(apply); });
    search.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing && !composing) { event.preventDefault(); apply(); } });
    root.addEventListener('change', render);
    more.addEventListener('click', () => { limit += 6; render(); });
    if (root.querySelector('[name="ingredientIds"]')) root.addEventListener('scroll', () => {
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 24 && limit < matches.length) { limit += 6; render(); }
    }, { passive: true });
    render();
  });
  document.querySelectorAll('.related-details').forEach(details => {
    const label = details.querySelector('[data-related-search]'); label.hidden = false;
    label.querySelector('input').addEventListener('input', event => {
      details.querySelectorAll('li').forEach(li => { li.hidden = !normalize(li.textContent).includes(normalize(event.target.value.trim())); });
    });
  });
  const motion = document.querySelector('[data-motion-toggle]'), art = document.querySelector('.table-illustration');
  if (motion && art) {
    motion.hidden = reduced.matches;
    if (!reduced.matches) { art.dataset.motion = 'running'; motion.setAttribute('aria-pressed', 'false'); motion.textContent = 'Tạm dừng chuyển động'; }
    motion.addEventListener('click', () => {
      const paused = art.dataset.motion !== 'paused';
      art.dataset.motion = paused ? 'paused' : 'running';
      motion.setAttribute('aria-pressed', String(paused));
      motion.textContent = paused ? 'Tiếp tục chuyển động' : 'Tạm dừng chuyển động';
    });
    reduced.addEventListener('change', () => { motion.hidden = reduced.matches; if (reduced.matches) art.dataset.motion = 'paused'; });
  }
  document.addEventListener('click', event => {
    const a = event.target.closest('a');
    if (a && !event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && a.closest('[data-pagination],.active-filters')) busy(a.href);
  });
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('input,textarea,select,button,[contenteditable]:not([contenteditable="false"])')) return;
    const link = pagination?.querySelector(event.key === 'ArrowLeft' ? '[rel="prev"]' : event.key === 'ArrowRight' ? '[rel="next"]' : 'missing-link');
    if (link) { event.preventDefault(); link.click(); }
  });
  document.querySelectorAll('form[method="post"]').forEach(form => form.addEventListener('submit', event => {
    if (form.dataset.pending) { event.preventDefault(); return; }
    form.dataset.pending = 'true';
    setTimeout(() => form.querySelectorAll('button[type="submit"]').forEach(button => { button.disabled = true; }), 0);
  }));
  window.addEventListener('pagehide', () => {
    timers.forEach(clearTimeout); timers.clear();
    try { sessionStorage.setItem('table-previous', JSON.stringify({ path: location.pathname, page: Number(pagination?.dataset.page || 1) })); } catch { /* Storage may be unavailable. */ }
  });
  window.addEventListener('pageshow', () => {
    book?.classList.remove('departing'); book?.removeAttribute('aria-busy');
    document.querySelectorAll('form[data-pending]').forEach(form => { delete form.dataset.pending; form.querySelectorAll('button[type="submit"]').forEach(button => { button.disabled = false; }); });
    try {
      const previous = JSON.parse(sessionStorage.getItem('table-previous') || 'null');
      const page = Number(pagination?.dataset.page || 1);
      if (book && previous?.path === location.pathname && previous.page !== page && !reduced.matches) {
        book.dataset.direction = page < previous.page ? 'back' : 'forward';
        book.classList.add('arriving'); setTimeout(() => book.classList.remove('arriving'), 650);
      }
    } catch { /* Native navigation still works without storage. */ }
  });
})();
