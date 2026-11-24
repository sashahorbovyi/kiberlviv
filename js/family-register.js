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
  const model = window.TrainingModel;
  if (!model) return;
  const formats = model.lessonFormats;
  const formatNotes = {
    individual: 'Заняття один на один: розбір ваших рішень, вправи та зворотний зв’язок.',
    group: '3–5 учасників: спільні вправи й розбір командних рішень. Ціна за учасника.'
  };
  const packages = model.lessonPackages;
  const game = booking('game');
  const format = booking('format');
  const duration = booking('lesson-duration');
  const applicant = booking('applicant');
  const choices = [...form.querySelectorAll('[name="package"]')];
  let params = new URLSearchParams();
  let calculation;
  try {
    const incoming = model.parse(location.search);
    if ((incoming.game !== undefined && !Object.hasOwn(games, incoming.game)) ||
        (incoming.format !== undefined && !Object.hasOwn(formats, incoming.format)) ||
        (incoming.package !== undefined && !Object.hasOwn(packages, incoming.package)) ||
        (incoming.duration !== undefined && !model.lessonDurations.some(minutes => String(minutes) === incoming.duration)) ||
        (incoming.applicant !== undefined && !['adult', 'parent'].includes(incoming.applicant)) ||
        (incoming.from !== undefined && incoming.from !== 'calculator')) {
      throw new Error('Посилання містить недопустимий вибір.');
    }
    if (incoming.from === 'calculator') calculation = model.calculate(incoming);
    params = new URLSearchParams(incoming);
  } catch {
    const warning = booking('link-warning');
    warning.textContent = 'Не вдалося відновити параметри з посилання. Відкрито стандартний варіант; перевірте гру, формат і пакет.';
    warning.hidden = false;
  }
  const isLive = location.origin === form.dataset.liveOrigin;
  const hryvnias = model.formatPrice;
  const countLabel = count => count + (count === 8 ? ' занять' : ' заняття');
  const choice = key => choices.find(input => input.value === key) || choices[0];
  game.value = Object.hasOwn(games, params.get('game')) ? params.get('game') : 'CS2';
  format.value = Object.hasOwn(formats, params.get('format')) ? params.get('format') : 'individual';
  duration.min = model.standardLessonMinutes;
  duration.max = model.sessionLimit;
  duration.step = model.extensionStepMinutes;
  const chosenDuration = model.lessonDurations.find(minutes => String(minutes) === params.get('duration'));
  duration.value = String(chosenDuration ?? (calculation ? model.suggestLessonDuration(calculation.total) : model.standardLessonMinutes));
  choice(params.get('package')).checked = true;
  applicant.value = params.get('applicant') === 'parent' ? 'parent' : 'adult';

  function selection() {
    const gameName = game.value;
    const mode = formats[format.value];
    const selected = choices.filter(input => input.checked);
    const packId = selected[0]?.value;
    const pack = packages[packId];
    const minutes = Number(duration.value);
    const quote = model.lessonQuote(format.value, packId, minutes);
    if (!Object.hasOwn(games, gameName) || selected.length !== 1 || !quote || !['adult', 'parent'].includes(applicant.value)) return null;
    return { gameName, mode, pack, minutes, quote };
  }

  function refresh() {
    const selected = selection();
    const submit = form.querySelector('button[type="submit"]');
    if (!selected) {
      submit.disabled = true;
      booking('inline-total').textContent = 'Перевірте параметри';
      field('submit-error').textContent = 'Оберіть одну гру, один формат та один пакет із допустимою тривалістю.';
      field('submit-error').dataset.selectionError = 'true';
      field('submit-error').hidden = false;
      return;
    }
    submit.disabled = sending || submitted;
    if (!sending && field('submit-error').dataset.selectionError === 'true') {
      field('submit-error').hidden = true;
      delete field('submit-error').dataset.selectionError;
    }
    const { gameName, mode, pack, minutes, quote } = selected;
    const { base, extension, extraMinutes, total } = quote;
    const durationLabel = model.format(minutes) + (extraMinutes ? ' · +' + extraMinutes + ' хв' : '');
    booking('lesson-duration-value').textContent = durationLabel;
    duration.setAttribute('aria-valuetext', model.format(minutes));
    const program = games[gameName];
    booking('format-note').textContent = formatNotes[format.value];
    booking('duration-help').textContent = `+${hryvnias(mode.extensionPrice)} за кожні додаткові ${model.extensionStepMinutes} хв одного заняття${format.value === 'group' ? ' за учасника' : ''}. У пакеті додатковий час застосовується до всіх занять.`;
    for (const key of Object.keys(packages)) {
      form.querySelector('[data-price="' + key + '"]').textContent = hryvnias(model.lessonPrice(format.value, key, minutes));
    }
    booking('plan-title').textContent = 'Що входить у пакет «' + pack.title + '»';
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
    booking('duration').textContent = countLabel(pack.count) + ' × ' + model.format(minutes);
    booking('price-breakdown').hidden = !extension;
    booking('price-breakdown').textContent = extension
      ? `${hryvnias(base)} за стандартний пакет + ${hryvnias(extension)} за додаткові ${extraMinutes} хв до кожного заняття.`
      : '';
    booking('unit').textContent = hryvnias(total / pack.count);
    for (const key of ['total', 'inline-total']) booking(key).textContent = hryvnias(total);
    const currentCalculation = calculation?.config.game === gameName ? calculation : null;
    const calculator = 'calculator.html?' + (currentCalculation
      ? model.serialize(currentCalculation.config)
      : new URLSearchParams({ game: gameName, focus: program.focus }));
    booking('calculator').setAttribute('href', calculator);
    booking('success-calculator').setAttribute('href', calculator);
    booking('calculation').hidden = !currentCalculation;
    booking('time-fit').hidden = true;
    if (currentCalculation) {
      const { config, total } = currentCalculation;
      const focus = model.games[gameName].focuses[config.focus][0];
      booking('calculation-text').textContent = `${gameName} · ${focus} · ${model.format(total)} на самостійну практику`;
      booking('edit-calculation').setAttribute('href', calculator);
      if (config.mode !== 'matches') {
        booking('time-fit').hidden = false;
        booking('time-fit').textContent = minutes <= config.budget
          ? `Ця тривалість вміщується у ваш ліміт ${model.format(config.budget)}.`
          : `Вибрано ${minutes} хв. Ваш ліміт — ${model.format(config.budget)}.`;
      }
    }
    if (model) {
      booking('practice-link').setAttribute('href', model.programLink(gameName));
      booking('practice-link').textContent = 'Переглянути самостійну програму ' + gameName;
    }
    const query = new URLSearchParams({
      game: gameName, format: format.value,
      duration: String(minutes),
      package: choices.find(input => input.checked)?.value || 'intro', applicant: applicant.value
    });
    if (currentCalculation) {
      for (const [key, value] of new URLSearchParams(model.serialize(currentCalculation.config))) query.set(key, value);
      query.set('from', 'calculator');
    }
    booking('live-link').setAttribute('href', form.dataset.liveOrigin + '/register.html?' + query + '#booking-options');
    booking('applicant-note').textContent = applicant.value === 'parent'
      ? 'Укажіть лише ім’я та пошту дорослого. Дані дитини не потрібні.'
      : 'Залиште свої контактні дані.';
  }

  let sending = false;
  let submitted = false;
  for (const input of [game, format, duration, applicant, ...choices]) input.addEventListener('change', refresh);
  duration.addEventListener('input', refresh);
  refresh();

  const nickname = field('nickname');
  const email = field('email');
  field('unavailable').hidden = isLive;
  field('contacts').hidden = !isLive;
  field('contacts').disabled = !isLive;
  const consent = field('consent');
  const submit = form.querySelector('button[type="submit"]');
  const submitError = field('submit-error');
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
    if (!isLive || sending || submitted) return;
    submitError.hidden = true;
    const invalid = [...rules.keys()].filter(input => !validate(input));
    if (invalid.length) return invalid[0].focus();

    const selected = selection();
    if (!selected) {
      refresh();
      return;
    }
    const { gameName, mode, pack, minutes } = selected;
    const body = new URLSearchParams({
      'form-name': 'family-registration',
      'family-name': nickname.value.trim(),
      email: email.value.trim(),
      game: gameName,
      format: mode.title,
      duration: String(minutes),
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
      submitted = true;
      form.hidden = true;
      form.reset();
      field('success').hidden = false;
      field('success-title').focus();
    } catch {
      submitError.textContent = 'Не вдалося надіслати заявку. Спробуйте ще раз.';
      submitError.hidden = false;
    } finally {
      sending = false;
      submit.disabled = submitted;
      submit.textContent = 'Надіслати заявку';
      form.removeAttribute('aria-busy');
    }
  });

  form.noValidate = true;
  form.hidden = false;
})();
