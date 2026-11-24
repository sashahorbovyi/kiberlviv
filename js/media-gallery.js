document.addEventListener('DOMContentLoaded', () => {
  const section = document.getElementById('training-gallery');
  if (!section) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const carousel = section.querySelector('.media-swiper');
  const controls = section.querySelector('.media-controls');
  const toggle = controls.querySelector('[data-media-autoplay]');
  let swiper;
  let visible = !('IntersectionObserver' in window);
  let autoEnabled = !reducedMotion.matches;
  let hovered = false;
  let opener;
  let previewOpen = false;

  function updateAutoplay() {
    if (!swiper) return;
    toggle.setAttribute('aria-pressed', String(autoEnabled));
    toggle.title = autoEnabled ? 'Зупинити автопрокручування' : 'Увімкнути автопрокручування';
    if (autoEnabled && visible && !hovered && !document.hidden && !previewOpen && !reducedMotion.matches) {
      if (!swiper.autoplay.running) swiper.autoplay.start();
    } else if (swiper.autoplay.running) {
      swiper.autoplay.stop();
    }
  }

  if (typeof window.Swiper === 'function' && document.getElementById('swiper-css')?.sheet) {
    swiper = new window.Swiper(carousel, {
      slidesPerView: 1,
      spaceBetween: 16,
      breakpoints: { 640: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } },
      speed: reducedMotion.matches ? 0 : 420,
      rewind: true,
      autoplay: { enabled: false, delay: 5000, disableOnInteraction: false },
      navigation: {
        prevEl: controls.querySelector('[data-media-prev]'),
        nextEl: controls.querySelector('[data-media-next]')
      },
      pagination: {
        el: controls.querySelector('.media-dots'),
        clickable: true,
        renderBullet: (index, className) => `<button type="button" class="${className}" aria-label="Перейти до слайда ${index + 1}"></button>`
      },
      a11y: {
        prevSlideMessage: 'Попередній слайд',
        nextSlideMessage: 'Наступний слайд',
        firstSlideMessage: 'Перший слайд',
        lastSlideMessage: 'Останній слайд',
        paginationBulletMessage: 'Перейти до слайда {{index}}',
        slideLabelMessage: '{{index}} з {{slidesLength}}',
        slideRole: 'article',
        wrapperLiveRegion: false
      }
    });
    controls.hidden = false;
    // Swiper binds its hover and document listeners when autoplay is enabled
    // at init; visibility and hovering are handled here so we can start later.
    carousel.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse') return;
      hovered = true;
      updateAutoplay();
    });
    carousel.addEventListener('pointerleave', event => {
      if (event.pointerType !== 'mouse') return;
      hovered = false;
      updateAutoplay();
    });
    document.addEventListener('visibilitychange', updateAutoplay);
    toggle.hidden = reducedMotion.matches;
    toggle.addEventListener('click', () => { autoEnabled = !autoEnabled; updateAutoplay(); });
    section.addEventListener('focusin', event => {
      if (event.target === toggle) return;
      autoEnabled = false;
      updateAutoplay();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        updateAutoplay();
      }, { threshold: .25 }).observe(carousel);
    }
    reducedMotion.addEventListener('change', event => {
      autoEnabled = !event.matches;
      toggle.hidden = event.matches;
      swiper.params.speed = event.matches ? 0 : 420;
      updateAutoplay();
    });
    updateAutoplay();
  }

  if (typeof window.GLightbox === 'function' && document.getElementById('glightbox-css')?.sheet) {
    const template = document.getElementById('media-preview-template');
    const sections = {
      calculator: ['Приклад заняття у CS2', [
        ['Розминка й вправи', '30 хв'], ['Один матч', '35 хв'], ['Розбір після гри', '10 хв'], ['Усього', '75 хв']
      ], 'Приклад розподілу часу. Тривалість можна змінити в калькуляторі.'],
      training: ['Що можна потренувати', [
        ['CS2', 'Прицілювання та рух'], ['Dota 2', 'Добивання кріпів'], ['Valorant', 'Робота з кутами']
      ]],
      parents: ['Теми гіда', [
        ['Знайомство', 'Що таке кіберспорт'], ['Баланс', 'Як домовитися про час гри'], ['Розмова', 'Що обговорити після матчу']
      ]],
      tips: ['Про що почитати', [
        ['Баланс', 'Тренування й відпочинок'], ['Практика', 'Як розбити вправу на кроки'], ['Розбір', 'Що записати після гри']
      ]],
      reviews: ['Як залишити відгук', [
        ['Оціни сайт', 'Від 1 до 5'], ['Опиши досвід', 'Що зручно і чого бракує'], ['Переглянь приклади', 'Три демонстраційні відгуки']
      ]]
    };
    let pendingAnchor = '';
    const album = window.GLightbox({
      elements: [],
      width: '760px',
      height: 'auto',
      closeButton: false,
      draggable: false,
      touchNavigation: false,
      keyboardNavigation: false,
      openEffect: 'none',
      closeEffect: 'none'
    });
    section.addEventListener('click', event => {
      const link = event.target.closest('[data-media-preview]');
      if (!link || !template || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const card = link.closest('.swiper-slide');
      const [heading, rows, note] = sections[link.dataset.mediaPreview] || [];
      if (!card || !heading) return;

      const panel = template.content.firstElementChild.cloneNode(true);
      panel.querySelector('h2').textContent = card.querySelector('h3').textContent;
      panel.querySelector('.site-preview-description').textContent = card.querySelector('p').textContent;
      panel.querySelector('.site-preview-sample-title').textContent = heading;
      const list = panel.querySelector('.site-preview-rows');
      for (const [label, value] of rows) {
        const row = document.createElement('div');
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = label;
        dd.textContent = value;
        row.append(dt, dd);
        list.append(row);
      }
      if (note) {
        const caption = panel.querySelector('.site-preview-note');
        caption.textContent = note;
        caption.hidden = false;
      }
      const cta = panel.querySelector('.site-preview-cta');
      const cardLink = card.querySelector('.media-card-link');
      const href = cardLink.getAttribute('href');
      cta.setAttribute('href', href);
      cta.textContent = cardLink.textContent.trim();
      cta.addEventListener('click', e => {
        if (!href.startsWith('#') || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        pendingAnchor = href;
        album.close();
      });

      event.preventDefault();
      opener = link;
      album.setElements([{ content: panel, type: 'inline' }]);
      album.openAt(0);
    });
    album.on('open', () => {
      previewOpen = true;
      updateAutoplay();
      const modal = document.getElementById('glightbox-body');
      if (!modal) return;
      modal.classList.add('site-preview-modal');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'site-preview-title');
      const close = modal.querySelector('.site-preview-close');
      const cta = modal.querySelector('.site-preview-cta');
      close?.focus({ preventScroll: true });
      modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          album.close();
        } else if (event.key === 'Tab' && close && cta) {
          event.preventDefault();
          (document.activeElement === close ? cta : close).focus();
        }
      });
    });
    album.on('close', () => {
      previewOpen = false;
      if (pendingAnchor) {
        const anchor = pendingAnchor;
        pendingAnchor = '';
        window.location.hash = anchor;
        document.getElementById(anchor.slice(1))?.scrollIntoView();
      } else opener?.focus({ preventScroll: true });
      opener = null;
      updateAutoplay();
    });
  }
});
