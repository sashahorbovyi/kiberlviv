(() => {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const action = new URL(form.getAttribute('action'), location.href);
  // A normal HTML POST from the GitHub mirror also works without CORS or JS.
  if (location.origin !== action.origin) return;
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('contact-status');
  let submitting = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    submitting = true;
    button.disabled = true;
    button.textContent = 'Надсилаємо…';
    form.setAttribute('aria-busy', 'true');
    status.hidden = false;
    status.textContent = 'Передаємо ваше звернення…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(action.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Submission not accepted');
      location.assign(action.href);
    } catch {
      status.textContent = 'Не вдалося підтвердити надсилання. Введені дані залишилися у формі. Перевірте з’єднання та спробуйте ще раз.';
      status.setAttribute('tabindex', '-1');
      status.focus();
    } finally {
      clearTimeout(timeout);
      submitting = false;
      button.disabled = false;
      button.textContent = 'Надіслати звернення';
      form.removeAttribute('aria-busy');
    }
  });
})();
