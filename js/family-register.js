(() => {
  const form = document.getElementById('family-form');
  if (!form) return;

  const field = key => document.getElementById('family-' + key);
  const booking = key => document.getElementById('booking-' + key);
  const games = {
    CS2: {
      focus: 'mechanics',
      steps: ['Зупинка перед пострілом: порахуйте вчасні зупинки з десяти спроб.', 'Розіграйте один вихід у парі: узгодьте позицію і момент підтримки.', 'Повторіть той самий тест і розберіть з тренером два схожі раунди.'],
      stretch: 'Перевірте вправу на другій карті й порівняйте, що змінилося в командному виході.'
    },
    'Dota 2': {
      focus: 'lane',
      steps: ['Виміряйте добивання крипів за перші п’ять хвилин на знайомому герої.', 'Розберіть рішення на лінії та оберіть момент для переміщення після хвилі.', 'Повторіть тест добивань і перегляньте два рішення про переміщення на карті.'],
      stretch: 'Застосуйте той самий підхід на іншому герої своєї ролі та порівняйте результати.'
    },
    Valorant: {
      focus: 'positioning',
      steps: ['Перевірте, як часто після першого контакту ви можете повернутися в укриття.', 'Розіграйте вихід на точку, узгодивши здібність і рух напарника.', 'Повторіть сценарій і порівняйте три раунди за позицією та часом застосування здібності.'],
      stretch: 'Перенесіть сценарій на іншу точку карти й перевірте, що варто змінити в комунікації.'
    }
  };
  const formats = {
    individual: { title: 'Індивідуально', minutes: 60, note: 'Заняття один на один: розбір ваших рішень, вправи та зворотний зв’язок. 60 хв.', prices: [690, 2390, 4390] },
    group: { title: 'Мала група', minutes: 75, note: '3–5 учасників: спільні вправи й розбір командних рішень. 75 хв. Ціна за учасника.', prices: [390, 1390, 2590] }
  };
  const packages = {
    intro: { title: 'Пробне', count: 1, index: 0 },
    base: { title: 'Основа', count: 4, index: 1 },
    progress: { title: 'Прогрес', count: 8, index: 2 }
  };
  const game = booking('game');
  const format = booking('format');
  const applicant = booking('applicant');
  const choices = [...form.querySelectorAll('[name="package"]')];
  const params = new URLSearchParams(location.search);
  const isLive = location.origin === form.dataset.liveOrigin;
  const money = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });
  const hryvnias = number => money.format(number) + ' грн';
  const countLabel = count => count + (count === 8 ? ' занять' : ' заняття');
  const choice = key => choices.find(input => input.value === key) || choices[0];
  game.value = Object.hasOwn(games, params.get('game')) ? params.get('game') : 'CS2';
  format.value = Object.hasOwn(formats, params.get('format')) ? params.get('format') : 'individual';
  choice(params.get('package')).checked = true;
  applicant.value = params.get('applicant') === 'parent' ? 'parent' : 'adult';

  function selection() {
    const gameName = game.value;
    const mode = formats[format.value];
    const pack = packages[choices.find(input => input.checked)?.value || 'intro'];
    return { gameName, mode, pack, total: mode.prices[pack.index] };
  }

  function refresh() {
    const { gameName, mode, pack, total } = selection();
    const program = games[gameName];
    booking('format-note').textContent = mode.note;
    for (const [key, item] of Object.entries(packages)) {
      form.querySelector('[data-price="' + key + '"]').textContent = hryvnias(mode.prices[item.index]);
    }
    booking('plan-title').textContent = 'План: ' + gameName + ' · ' + pack.title;
    const steps = pack.index === 0
      ? ['На занятті: ' + program.steps[0], 'Після заняття: повторіть вправу самостійно й запишіть початковий результат.']
      : pack.index === 1
        ? ['Заняття 1: ' + program.steps[0], 'Заняття 2–3: ' + program.steps[1], 'Заняття 4: ' + program.steps[2]]
        : ['Заняття 1–2: ' + program.steps[0], 'Заняття 3–5: ' + program.steps[1], 'Заняття 6–7: ' + program.stretch, 'Заняття 8: ' + program.steps[2]];
    if (format.value === 'group') steps.push('У групі міняйтеся ролями й після вправи коротко обговорюйте рішення команди.');
    booking('plan').replaceChildren(...steps.map(step => {
      const item = document.createElement('li');
      item.textContent = step;
      return item;
    }));
    booking('selection').textContent = gameName + ' · ' + mode.title;
    booking('duration').textContent = countLabel(pack.count) + ' × ' + mode.minutes + ' хв';
    booking('unit').textContent = hryvnias(total / pack.count);
    for (const key of ['total', 'inline-total']) booking(key).textContent = hryvnias(total);
    const calculator = 'calculator.html?' + new URLSearchParams({ game: gameName, focus: program.focus });
    booking('calculator').setAttribute('href', calculator);
    booking('success-calculator').setAttribute('href', calculator);
    const model = window.TrainingModel;
    if (model) {
      booking('practice-link').setAttribute('href', model.programLink(gameName));
      booking('practice-link').textContent = 'Переглянути самостійну програму ' + gameName;
    }
    const query = new URLSearchParams({
      game: gameName, format: format.value,
      package: choices.find(input => input.checked)?.value || 'intro', applicant: applicant.value
    });
    booking('live-link').setAttribute('href', form.dataset.liveOrigin + '/register.html?' + query + '#booking-options');
    booking('applicant-note').textContent = applicant.value === 'parent'
      ? 'Укажіть лише ім’я та пошту дорослого. Дані дитини не потрібні.'
      : 'Залиште свої контактні дані.';
  }

  for (const input of [game, format, applicant, ...choices]) input.addEventListener('change', refresh);
  refresh();

  const nickname = field('nickname');
  const email = field('email');
  field('unavailable').hidden = isLive;
  field('contacts').hidden = !isLive;
  field('contacts').disabled = !isLive;
  const consent = field('consent');
  const submit = form.querySelector('button[type="submit"]');
  const submitError = field('submit-error');
  let sending = false;
  const emailPattern = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u;
  const rules = new Map([
    [nickname, () => {
      const length = nickname.value.trim().length;
      return length >= 2 && length <= 40 ? '' : 'Введіть від 2 до 40 символів.';
    }],
    [email, () => email.value.length <= 254 && emailPattern.test(email.value.trim()) && !email.validity?.typeMismatch
      ? '' : 'Введіть адресу на зразок family@example.com.'],
    [consent, () => consent.checked ? '' : 'Підтвердьте надсилання контактних даних.']
  ]);

  function paint(input, error, initial = false) {
    const message = document.getElementById(input.id + '-error');
    message.textContent = error;
    message.hidden = !error;
    if (initial) {
      input.removeAttribute('aria-invalid');
      delete input.dataset.state;
    } else {
      input.setAttribute('aria-invalid', String(Boolean(error)));
      input.dataset.state = error ? 'error' : 'valid';
    }
  }

  function validate(input) {
    const error = rules.get(input)();
    paint(input, error);
    return !error;
  }

  for (const input of rules.keys()) {
    input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', () => {
      if (input.hasAttribute('aria-invalid')) validate(input);
    });
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!isLive || sending) return;
    submitError.hidden = true;
    const invalid = [...rules.keys()].filter(input => !validate(input));
    if (invalid.length) return invalid[0].focus();

    const { gameName, mode, pack } = selection();
    const body = new URLSearchParams({
      'form-name': 'family-registration',
      'family-name': nickname.value.trim(),
      email: email.value.trim(),
      game: gameName,
      format: mode.title,
      package: pack.title + ' · ' + countLabel(pack.count),
      applicant: applicant.value === 'parent' ? 'Для дитини (від дорослого)' : 'Для себе (18+)',
      'bot-field': field('trap').value
    });
    sending = true;
    submit.disabled = true;
    submit.textContent = 'Надсилаємо…';
    form.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('/', { method: 'POST', body });
      if (!response.ok) throw new Error('Family application submission failed');
      form.hidden = true;
      form.reset();
      field('success').hidden = false;
      field('success-title').focus();
    } catch {
      submitError.textContent = 'Не вдалося надіслати заявку. Спробуйте ще раз.';
      submitError.hidden = false;
    } finally {
      sending = false;
      submit.disabled = false;
      submit.textContent = 'Надіслати заявку';
      form.removeAttribute('aria-busy');
    }
  });

  form.noValidate = true;
  form.hidden = false;
})();
