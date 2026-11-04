(() => {
  const video = document.querySelector('#hero-promo');
  const button = document.querySelector('.hero-video-toggle');
  if (!video || !button) return;

  const label = button.querySelector('.hero-video-toggle-label');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 649px)');
  const connection = navigator.connection;
  const canAutoplay = () => !motion.matches && !mobile.matches && !connection?.saveData;
  let wantsPlayback = canAutoplay();
  let inView = true;
  let request = 0;

  function updateLabel() {
    const playing = !video.paused && !video.ended;
    button.dataset.playing = String(playing);
    label.textContent = playing ? 'Призупинити відео' : 'Увімкнути відеофон';
  }

  async function syncPlayback() {
    const currentRequest = ++request;
    if (!wantsPlayback || !inView || document.hidden) {
      video.pause();
      updateLabel();
      return;
    }
    const source = video.querySelector('source');
    if (!source.hasAttribute('src')) {
      source.src = source.dataset.src;
      video.load();
    }
    video.muted = true;
    try {
      await video.play();
      // A user pause or a visibility change may have happened during loading.
      if (currentRequest !== request && (!wantsPlayback || !inView || document.hidden)) video.pause();
    } catch {
      // The poster stays visible if autoplay is blocked or the file cannot load.
    }
    updateLabel();
  }

  button.hidden = false;
  button.addEventListener('click', () => {
    wantsPlayback = video.paused;
    syncPlayback();
  });
  for (const event of ['playing', 'pause', 'ended', 'error']) video.addEventListener(event, updateLabel);
  document.addEventListener('visibilitychange', syncPlayback);
  // Respect a newly enabled motion/data restriction without overriding a manual pause.
  const restrictAutoplay = () => {
    if (!canAutoplay()) {
      wantsPlayback = false;
      syncPlayback();
    }
  };
  motion.addEventListener('change', restrictAutoplay);
  mobile.addEventListener('change', restrictAutoplay);
  connection?.addEventListener?.('change', restrictAutoplay);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncPlayback();
    }).observe(video.closest('.hero'));
  } else {
    syncPlayback();
  }
})();
