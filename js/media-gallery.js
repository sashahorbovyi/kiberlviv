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
  let albumOpen = false;

  function updateAutoplay() {
    if (!swiper) return;
    toggle.textContent = autoEnabled ? 'Призупинити' : 'Автогортання';
    if (autoEnabled && visible && !hovered && !document.hidden && !albumOpen && !reducedMotion.matches) {
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
        renderBullet: (_, className) => `<button type="button" class="${className}"></button>`
      },
      a11y: {
        prevSlideMessage: 'Попередній слайд',
        nextSlideMessage: 'Наступний слайд',
        firstSlideMessage: 'Перший слайд',
        lastSlideMessage: 'Останній слайд',
        paginationBulletMessage: 'Перейти до слайда {{index}}',
        slideLabelMessage: '{{index}} з {{slidesLength}}',
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
    section.addEventListener('click', event => {
      const link = event.target.closest('.media-card-visual');
      if (link) opener = link;
    }, { capture: true });
    const album = window.GLightbox({
      selector: '#training-gallery .media-card-visual',
      openEffect: reducedMotion.matches ? 'none' : 'fade',
      closeEffect: reducedMotion.matches ? 'none' : 'fade',
      slideEffect: reducedMotion.matches ? 'none' : 'slide',
      touchNavigation: true,
      keyboardNavigation: true,
      zoomable: true,
      loop: true
    });
    album.on('open', () => {
      albumOpen = true;
      updateAutoplay();
      const modal = document.getElementById('glightbox-body');
      if (!modal) return;
      modal.setAttribute('aria-label', 'Ілюстрації до тренування');
      for (const [selector, name] of [['.gclose', 'Закрити альбом'], ['.gprev', 'Попереднє зображення'], ['.gnext', 'Наступне зображення']]) {
        modal.querySelector(selector)?.setAttribute('aria-label', name);
      }
    });
    album.on('close', () => {
      albumOpen = false;
      opener?.focus({ preventScroll: true });
      opener = null;
      updateAutoplay();
    });
  }
});
