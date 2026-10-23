(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const deck = document.getElementById('deck');
  const stage = document.querySelector('.stage');
  const previous = document.getElementById('previous');
  const next = document.getElementById('next');
  const counter = document.getElementById('counter');
  const progress = document.getElementById('progress');
  let current = 0;

  function render() {
    slides.forEach((slide, index) => {
      const active = index === current;
      slide.classList.toggle('active', active);
      slide.hidden = !active;
      slide.setAttribute('aria-hidden', String(!active));
      slide.inert = !active;
    });
    counter.textContent = `${String(current + 1).padStart(2, '0')} / ${slides.length}`;
    previous.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    progress.style.width = `${((current + 1) / slides.length) * 100}%`;
    document.title = `Block 6 · ${current + 1}/${slides.length} · ${slides[current].querySelector('h1,h2').textContent.trim()}`;
  }

  function indexFromHash() {
    const match = location.hash.match(/^#slide-(\d+)$/);
    return match ? Math.max(0, Math.min(slides.length - 1, Number(match[1]) - 1)) : 0;
  }

  function go(index) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    try { history.replaceState(null, '', `#slide-${current + 1}`); } catch { /* file:// remains usable */ }
    render();
  }

  function fit() {
    const { width, height } = stage.getBoundingClientRect();
    const scale = Math.min(width / 1280, height / 720);
    deck.style.transform = `scale(${scale})`;
    deck.style.left = `${Math.max(0, (width - 1280 * scale) / 2)}px`;
    deck.style.top = `${Math.max(0, (height - 720 * scale) / 2)}px`;
  }

  previous.addEventListener('click', () => go(current - 1));
  next.addEventListener('click', () => go(current + 1));
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    const destinations = {
      ArrowRight: current + 1, ArrowDown: current + 1,
      ArrowLeft: current - 1, ArrowUp: current - 1,
      Home: 0, End: slides.length - 1,
    };
    if (Object.hasOwn(destinations, event.key)) {
      event.preventDefault();
      go(destinations[event.key]);
    }
  });
  window.addEventListener('resize', fit);
  window.addEventListener('hashchange', () => { current = indexFromHash(); render(); });
  current = indexFromHash();
  render();
  fit();
})();

