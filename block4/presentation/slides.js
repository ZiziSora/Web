(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const deck = document.getElementById('deck');
  const stage = document.querySelector('.stage');
  const previous = document.getElementById('previous');
  const next = document.getElementById('next');
  const counter = document.getElementById('counter');
  const progress = document.getElementById('progress');
  let current = 0;

  function loadMedia(slide) {
    for (const frame of slide.querySelectorAll('.media[data-file]')) {
      if (frame.dataset.attempted) continue;
      frame.dataset.attempted = 'true';
      const media = document.createElement('img');
      media.alt = frame.dataset.alt || frame.dataset.file;
      const reveal = () => frame.classList.add('loaded');
      media.addEventListener('load', reveal, { once: true });
      media.addEventListener('error', () => media.remove(), { once: true });
      media.src = `assets/${frame.dataset.file}`;
      frame.append(media);
    }
  }

  function render() {
    slides.forEach((slide, i) => {
      const active = i === current;
      slide.classList.toggle('active', active);
      slide.hidden = !active;
      slide.setAttribute('aria-hidden', String(!active));
      slide.inert = !active;
    });
    counter.textContent = `${String(current + 1).padStart(2, '0')} / ${slides.length}`;
    previous.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    progress.style.width = `${((current + 1) / slides.length) * 100}%`;
    loadMedia(slides[current]);
  }

  function go(index) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    const hash = `#slide-${current + 1}`;
    // Keep file:// opening usable, including browsers that restrict local history.
    try { history.replaceState(null, '', hash); } catch { /* Navigation still works. */ }
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
      Home: 0, End: slides.length - 1
    };
    if (Object.hasOwn(destinations, event.key)) {
      event.preventDefault();
      go(destinations[event.key]);
    }
  });
  window.addEventListener('resize', fit);
  window.addEventListener('hashchange', () => {
    const match = location.hash.match(/^#slide-(\d+)$/);
    if (match) go(Number(match[1]) - 1);
  });
  window.addEventListener('beforeprint', () => slides.forEach(loadMedia));
  const match = location.hash.match(/^#slide-(\d+)$/);
  current = match ? Math.max(0, Math.min(slides.length - 1, Number(match[1]) - 1)) : 0;
  render();
  fit();
})();
