(() => {
  const card = document.getElementById('review-local');
  if (!card) return;
  const key = 'kiberlviv.review.v1';
  const status = document.getElementById('review-local-status');
  const rating = document.getElementById('review-local-rating');
  const message = document.getElementById('review-local-message');
  function render() {
    let value;
    try { value = JSON.parse(localStorage.getItem(key)); } catch { value = null; }
    const valid = Number.isInteger(value?.rating) && value.rating >= 1 && value.rating <= 5
      && typeof value.message === 'string' && value.message.length >= 10 && value.message.length <= 3000;
    card.hidden = !valid;
    rating.textContent = valid ? value.rating + ' із 5' : '';
    message.textContent = valid ? value.message : '';
  }
  document.getElementById('review-local-remove').addEventListener('click', () => {
    try {
      localStorage.removeItem(key);
      render();
      document.querySelector('.reviews-cta').focus();
      status.textContent = 'Чернетку відгуку прибрано.';
    } catch { status.textContent = 'Браузер не дозволив прибрати чернетку.'; }
  });
  window.addEventListener('pageshow', render);
  render();
})();
