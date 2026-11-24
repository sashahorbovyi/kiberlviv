for (const menu of document.querySelectorAll('header .header-mobile-menu')) {
  document.addEventListener('click', event => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  menu.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !menu.open) return;
    event.preventDefault();
    menu.open = false;
    menu.querySelector('summary').focus();
  });
}

(() => {
  if (!('IntersectionObserver' in window)) return;

  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const text = [
    'main :is(h1,h2,h3)', '.hero-description', '.hero-project-note',
    'main :is(.section-heading,.site-container,.section-inner) > p:not([role])',
    'main :is(.page-intro,.reviews-note,.article-lead,.feature-intro)',
    'main .article-body :is(p,ul,ol)'
  ].join(',');
  const visuals = [
    'main figure', 'main img:not([aria-hidden="true"])', 'main iframe',
    'main svg[role="img"]'
  ].join(',');
  const selectors = [
    text, visuals,
    '#process article', '#blog article', '#location aside',
    '.calculator-preview', '.feature-item', '.weekly-detail', '.time-balance',
    '.home-programs > a', '.creator-card', '.coach-demo-card', '.program-game', '.program-module',
    '.tips-card', '.article-body > section', '.article-callout', '.article-hero-cover',
    '.about-card', '.about-workflow > li', '.about-research-card', '.about-status-card', '.about-example',
    '.parents-info-card', '.parents-game-card', '.parents-myth-card', '.parents-video-card',
    '.parents-steps > li', '.parents-agreement-example', '.parents-attention-card',
    '.training-form-grid > div', '.training-mode-choices', '.game-choices',
    '.metric-grid > div', '.training-breakdown', '.training-week-list > li',
    '.practice-checklist > li', '.support-copy', '.support-form',
    '.review-card', '.reviews-heading .reviews-cta', '.media-card-visual', '.media-card-copy',
    '.hero-text > div', '.page-actions', '.section-actions',
    'main details', 'footer .site-container > div'
  ].join(',');
  const candidates = [...document.querySelectorAll(selectors)];
  const selected = new Set(candidates);
  // Animate one layer at a time so nested content does not move twice.
  const pending = new Set(candidates.filter(node => {
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      if (selected.has(parent)) return false;
    }
    return true;
  }));
  const active = new Set();
  function stagger(target) {
    const siblings = target.parentElement?.children || [];
    let preceding = 0;
    for (const sibling of siblings) {
      if (sibling === target) break;
      if (selected.has(sibling) && !sibling.hidden) preceding++;
    }
    target.dataset.motionStep = String(preceding % 4);
    target.dataset.motionKind = target.matches(text) ? 'text' : target.matches(visuals) ? 'visual' : 'block';
  }
  function anchorTarget() {
    if (window.location.hash.length < 2) return null;
    try { return document.getElementById(decodeURIComponent(window.location.hash.slice(1))); }
    catch { return null; }
  }
  const observer = new IntersectionObserver(entries => {
    if (preference.matches) return;
    const anchor = anchorTarget();
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting || !pending.delete(target)) continue;
      observer.unobserve(target);
      const focused = document.activeElement;
      if ((focused && target.contains(focused)) || (anchor && (target.contains(anchor) || anchor.contains(target)))) continue;
      stagger(target);
      active.add(target);
      target.classList.add('motion-enter');
    }
  }, { rootMargin: '0px 0px -5% 0px' });

  function clear(node) {
    if (!active.delete(node)) return;
    node.classList.remove('motion-enter');
    delete node.dataset.motionStep;
    delete node.dataset.motionKind;
  }
  document.addEventListener('animationend', event => {
    if (event.animationName === 'motion-viewport-enter') clear(event.target);
  });
  document.addEventListener('animationcancel', event => {
    if (event.animationName === 'motion-viewport-enter') clear(event.target);
  });
  document.addEventListener('focusin', event => {
    const animated = event.target.closest('.motion-enter');
    if (animated) clear(animated);
  });
  window.addEventListener('hashchange', () => {
    const anchor = anchorTarget();
    if (anchor) active.forEach(node => {
      if (node.contains(anchor) || anchor.contains(node)) clear(node);
    });
  });
  function update() {
    observer.disconnect();
    if (preference.matches) active.forEach(clear);
    else pending.forEach(node => observer.observe(node));
  }
  preference.addEventListener?.('change', update);
  update();
})();

(() => {
  const line = document.querySelector('[data-typing]');
  if (!line || !('IntersectionObserver' in window)) return;
  const visual = line.querySelector('.cta-typing');
  const output = line.querySelector('.cta-typing-text');
  const phrases = [...line.querySelectorAll('.cta-typing-measure')].map(node => Array.from(node.textContent));
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let length = 0;
  let deleting = false;
  let visible = false;
  let timer;

  const canPlay = () => visible && !document.hidden && !preference.matches;
  const render = () => { output.textContent = phrases[index].slice(0, length).join(''); };

  function step() {
    if (!canPlay()) return;
    const end = phrases[index].length;
    let delay;
    if (deleting && length === 0) {
      index = (index + 1) % phrases.length;
      deleting = false;
      delay = 190;
    } else if (deleting) {
      length--;
      delay = 28;
    } else if (length === end) {
      deleting = true;
      delay = 28;
    } else {
      length++;
      delay = length === end ? 2400 : 55;
    }
    render();
    timer = setTimeout(step, delay);
  }

  function sync() {
    clearTimeout(timer);
    const running = canPlay();
    visual.toggleAttribute('data-running', running);
    if (running) {
      render();
      timer = setTimeout(step, length === phrases[index].length ? 2400 : 190);
    }
  }

  preference.addEventListener?.('change', () => {
    if (preference.matches) {
      index = 0;
      length = 0;
      deleting = false;
      output.textContent = phrases[0].join('');
    }
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }, { threshold: 0.5 }).observe(line);
  sync();
})();
