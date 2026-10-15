(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const deck = document.getElementById('deck');
  const stage = document.querySelector('.stage');
  const previous = document.getElementById('previous');
  const next = document.getElementById('next');
  const counter = document.getElementById('counter');
  const progress = document.getElementById('progress');
  const imageDialog = document.getElementById('image-dialog');
  const dialogImage = document.getElementById('image-dialog-image');
  const imageFit = document.getElementById('image-fit');
  const imageOriginal = document.getElementById('image-original');
  let imageTrigger = null;
  let current = 0;

  function setImageSize(original) {
    imageDialog.classList.toggle('actual-size', original);
    imageFit.setAttribute('aria-pressed', String(!original));
    imageOriginal.setAttribute('aria-pressed', String(original));
    const viewport = imageDialog.querySelector('.image-dialog-body');
    viewport.scrollTop = 0;
    viewport.scrollLeft = 0;
  }

  function closeImage() {
    if (imageDialog.open) imageDialog.close();
  }

  function openImage(image, trigger) {
    imageTrigger = trigger;
    dialogImage.src = image.src;
    dialogImage.alt = image.alt;
    document.getElementById('image-dialog-title').textContent = image.alt;
    setImageSize(false);
    imageDialog.showModal();
  }

  function loadMedia(slide) {
    for (const frame of slide.querySelectorAll('.media[data-file]')) {
      if (frame.dataset.attempted) continue;
      frame.dataset.attempted = 'true';
      const media = document.createElement('img');
      media.alt = frame.dataset.alt || frame.dataset.file;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'media-zoom';
      button.hidden = true;
      button.setAttribute('aria-label', `Phóng to: ${media.alt}`);
      button.setAttribute('aria-haspopup', 'dialog');
      button.addEventListener('click', () => openImage(media, button));
      button.append(media);
      const reveal = () => {
        frame.classList.add('loaded');
        button.hidden = false;
      };
      media.addEventListener('load', reveal, { once: true });
      media.addEventListener('error', () => button.remove(), { once: true });
      media.src = `assets/${frame.dataset.file}`;
      frame.append(button);
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
    closeImage();
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
  document.getElementById('image-close').addEventListener('click', closeImage);
  imageFit.addEventListener('click', () => setImageSize(false));
  imageOriginal.addEventListener('click', () => setImageSize(true));
  imageDialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeImage();
  });
  imageDialog.addEventListener('click', event => {
    if (event.target === imageDialog) closeImage();
  });
  imageDialog.addEventListener('close', () => {
    if (imageTrigger?.isConnected) imageTrigger.focus();
  });
  document.querySelectorAll('.evidence-tabs').forEach(tablist => {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    function selectTab(selected) {
      tabs.forEach(tab => {
        const active = tab === selected;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        document.getElementById(tab.dataset.mediaTarget).hidden = !active;
      });
    }
    tabs.forEach(tab => tab.addEventListener('click', () => selectTab(tab)));
    tablist.addEventListener('keydown', event => {
      const index = tabs.indexOf(event.target);
      if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectTab(tabs[target]);
      tabs[target].focus();
    });
  });
  document.addEventListener('keydown', event => {
    if (imageDialog.open) return;
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
