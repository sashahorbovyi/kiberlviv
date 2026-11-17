(() => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const email = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u;
  const phone = /^\+380[0-9]{9}$/;
  const subjects = new Set(['calculator', 'error', 'suggestion']);
  const rules = {
    name: field => field.value.trim().length < 2 ? 'Введіть щонайменше 2 символи.' : '',
    email: field => !email.test(field.value.trim()) || field.validity?.typeMismatch ? 'Введіть адресу у форматі name@example.com.' : '',
    phone: field => !phone.test(field.value) ? 'Введіть +380 і ще 9 цифр без пробілів.' : '',
    subject: field => !subjects.has(field.value) ? 'Оберіть тему звернення.' : '',
    message: field => field.value.trim().length < 10 ? 'Напишіть щонайменше 10 символів.' : '',
    privacy: field => !field.checked ? 'Позначте згоду, щоб продовжити.' : ''
  };
  const fields = Object.keys(rules).map(name => document.getElementById('contact-' + name));
  const action = new URL(form.getAttribute('action'), location.href);
  const live = location.origin === action.origin;
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('contact-status');
  const dialog = document.getElementById('contact-dialog');
  if (!live) document.getElementById('contact-mode').textContent = 'Демонстраційний режим: дані не передаються. Поля із зірочкою обов’язкові.';
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
    const message = live
      ? 'Ваше звернення передано. Дякуємо за зворотний зв’язок!'
      : 'Форма пройшла перевірку. Це демонстрація: дані не надіслано.';
    form.reset();
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
    const invalid = fields.filter(field => !validate(field));
    if (invalid.length) {
      status.hidden = true;
      invalid[0].focus();
      return;
    }
    if (!live) { showSuccess(); return; }

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
