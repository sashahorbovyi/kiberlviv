(() => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const email = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u;
  const subjects = new Set(['calculator', 'booking', 'error', 'suggestion', 'review']);
  const rules = {
    name: field => field.value.trim().length === 1 ? 'Введіть щонайменше 2 символи або залиште поле порожнім.' : '',
    email: field => !email.test(field.value.trim()) || field.validity?.typeMismatch ? 'Введіть адресу у форматі name@example.com.' : '',
    subject: field => field.value && !subjects.has(field.value) ? 'Оберіть тему зі списку.' : '',
    message: field => field.value.trim().length < 10 ? 'Напишіть щонайменше 10 символів.' : '',
    rating: field => !/^[1-5]$/.test(field.value) ? 'Оберіть оцінку від 1 до 5.' : '',
    privacy: field => !field.checked ? 'Позначте згоду, щоб продовжити.' : ''
  };
  const fields = Object.keys(rules).map(name => document.getElementById('contact-' + name));
  const action = new URL(form.getAttribute('action'), location.href);
  const live = location.origin === action.origin;
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('contact-status');
  const dialog = document.getElementById('contact-dialog');
  const topic = new URLSearchParams(location.search).get('topic');
  if (!live) {
    const link = document.getElementById('contact-primary-link');
    const official = new URL('/contact.html#contact-form', action.origin);
    if (subjects.has(topic)) official.searchParams.set('topic', topic);
    if (location.hostname === 'sashahorbovyi.github.io') location.replace(official.href);
    link.href = official.href;
    document.getElementById('contact-fields').hidden = true;
    document.getElementById('contact-primary').hidden = false;
    form.addEventListener('submit', event => event.preventDefault());
    return;
  }
  const subject = document.getElementById('contact-subject');
  if (!subject.value && subjects.has(topic)) subject.value = topic;
  const rating = document.getElementById('contact-rating');
  const ratingRow = document.getElementById('contact-rating-row');
  document.getElementById('contact-rating-help').textContent =
    'Відгук отримає автор сайту. Текст не публікується автоматично; не додавайте до нього особисті дані.';
  const syncRating = () => {
    const review = subject.value === 'review';
    ratingRow.hidden = !review;
    rating.disabled = !review;
    rating.required = review;
    if (!review) {
      rating.selectedIndex = 0;
      delete rating.dataset.state;
      rating.removeAttribute('aria-invalid');
      document.getElementById('contact-rating-error').hidden = true;
    }
  };
  subject.addEventListener('change', syncRating);
  syncRating();
  let submitting = false;

  function validate(field) {
    const max = Number(field.getAttribute('maxlength'));
    const error = rules[field.name](field) || (max && field.value.length > max ? 'Скоротіть введений текст.' : '');
    const message = document.getElementById(field.id + '-error');
    field.dataset.state = error ? 'error' : 'valid';
    field.setAttribute('aria-invalid', String(Boolean(error)));
    if (message.textContent !== error) message.textContent = error;
    message.hidden = !error;
    return !error;
  }

  for (const field of fields) {
    field.addEventListener('blur', () => { if (field.type !== 'checkbox' && (field.value || field.dataset.state)) validate(field); });
    field.addEventListener('input', () => { if (field.dataset.state) validate(field); });
    field.addEventListener('change', () => { if (field.type === 'checkbox' || field.localName === 'select') validate(field); });
  }

  function showSuccess() {
    const review = subject.value === 'review';
    const message = review ? 'Дякуємо! Відгук передано автору. Він не публікується автоматично.'
      : 'Ваше звернення передано. Дякуємо за зворотний зв’язок!';
    form.reset();
    syncRating();
    for (const field of fields) {
      delete field.dataset.state;
      field.removeAttribute('aria-invalid');
      const error = document.getElementById(field.id + '-error');
      error.hidden = true;
      error.textContent = '';
    }
    if (typeof dialog.showModal === 'function') {
      status.hidden = true;
      document.getElementById('contact-dialog-message').textContent = message;
      dialog.showModal();
    } else {
      status.hidden = false;
      status.textContent = message;
    }
  }

  let startedOutside = false;
  dialog.addEventListener('pointerdown', event => { startedOutside = event.target === dialog; });
  dialog.addEventListener('click', event => {
    if (startedOutside && event.target === dialog) dialog.close();
    startedOutside = false;
  });
  dialog.addEventListener('close', () => button.focus());

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || dialog.open) return;
    const invalid = fields.filter(field => !field.disabled && !validate(field));
    if (invalid.length) {
      status.hidden = true;
      invalid[0].focus();
      return;
    }
    submitting = true;
    button.disabled = true;
    button.textContent = 'Надсилаємо…';
    form.setAttribute('aria-busy', 'true');
    status.hidden = false;
    status.textContent = 'Передаємо ваше звернення…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let accepted = false;
    try {
      const body = new URLSearchParams(new FormData(form));
      for (const name of ['name', 'email', 'message']) body.set(name, body.get(name).trim());
      const response = await fetch(action.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Submission not accepted');
      accepted = true;
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
    if (accepted) showSuccess();
  });

  form.noValidate = true;
  button.disabled = false;
})();
