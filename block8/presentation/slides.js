(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const stage = document.querySelector('.stage');
  const deck = document.querySelector('.deck');
  const picker = document.getElementById('slide-picker');
  const previous = document.getElementById('previous');
  const next = document.getElementById('next');
  const notesButton = document.getElementById('notes-toggle');
  const drawer = document.getElementById('notes-drawer');
  const fullscreen = document.getElementById('fullscreen');
  const hashIndex = () => {
    const match = location.hash.match(/^#slide-(\d+)$/);
    return match ? Math.max(0, Math.min(slides.length - 1, Number(match[1]) - 1)) : 0;
  };
  let current = hashIndex();
  document.documentElement.classList.add('has-js');
  for (const [index, slide] of slides.entries()) {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${index < 16 ? index + 1 : 'A' + (index - 15)}. ${slide.dataset.title}`;
    picker.append(option);
  }
  function render() {
    slides.forEach((slide, index) => {
      const active = index === current;
      slide.classList.toggle('active', active);
      slide.inert = !active;
      slide.setAttribute('aria-hidden', String(!active));
    });
    picker.value = String(current);
    previous.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    document.getElementById('counter').textContent = `${String(current + 1).padStart(2, '0')} / ${slides.length}`;
    document.getElementById('progress').style.width = `${(current + 1) / slides.length * 100}%`;
    document.getElementById('announcement').textContent = `Slide ${current + 1}: ${slides[current].dataset.title}`;
    document.querySelector('.notes-content').innerHTML = slides[current].querySelector('.speaker-notes').innerHTML;
    document.title = `Block 8 · ${current + 1}/21 · ${slides[current].dataset.title}`;
  }
  function go(index) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    try { history.replaceState(null, '', `#slide-${current + 1}`); } catch { location.hash = `slide-${current + 1}`; }
    render();
  }
  function fit() {
    const { width, height } = stage.getBoundingClientRect();
    const scale = Math.min(width / 1280, height / 720);
    deck.style.transform = `scale(${scale})`;
    deck.style.left = `${Math.max(0, (width - 1280 * scale) / 2)}px`;
    deck.style.top = `${Math.max(0, (height - 720 * scale) / 2)}px`;
  }
  function notes(open = drawer.hidden) {
    drawer.hidden = !open;
    notesButton.setAttribute('aria-expanded', String(open));
    if (open) document.getElementById('notes-close').focus();
    else notesButton.focus();
  }
  previous.addEventListener('click', () => go(current - 1));
  next.addEventListener('click', () => go(current + 1));
  picker.addEventListener('change', () => go(Number(picker.value)));
  notesButton.addEventListener('click', () => notes());
  document.getElementById('notes-close').addEventListener('click', () => notes(false));
  document.getElementById('appendix').addEventListener('click', () => go(current < 16 ? 16 : 0));
  document.getElementById('print').addEventListener('click', () => window.print());
  fullscreen.hidden = !document.documentElement.requestFullscreen;
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { fullscreen.title = 'Có thể dùng F11 để toàn màn hình.'; }
  });
  document.addEventListener('fullscreenchange', () => { fullscreen.setAttribute('aria-pressed', String(!!document.fullscreenElement)); fit(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !drawer.hidden) { event.preventDefault(); notes(false); return; }
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing || event.repeat) return;
    if (event.target instanceof Element && event.target.closest('input,textarea,select,button,a,[contenteditable="true"]')) return;
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); notes(); return; }
    const target = { ArrowRight: current + 1, ArrowDown: current + 1, PageDown: current + 1, ' ': current + 1, ArrowLeft: current - 1, ArrowUp: current - 1, PageUp: current - 1, Home: 0, End: slides.length - 1 };
    if (Object.hasOwn(target, event.key)) { event.preventDefault(); go(target[event.key]); }
  });
  window.addEventListener('resize', fit);
  window.addEventListener('hashchange', () => { current = hashIndex(); render(); });
  render(); fit();
})();
