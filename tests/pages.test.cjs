const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const model = require('../js/training-model.js');
const root = path.join(__dirname, '..');
const origin = 'https://gilded-rabanadas-6b2d18.netlify.app';
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup(page, search = '', overrides = {}) {
  const { document, Event } = parseHTML(fs.readFileSync(path.join(root, page), 'utf8'));
  // Linkedom has a getter-only select.value; model the browser setter in tests.
  for (const select of document.querySelectorAll('select')) {
    let value = select.value || select.options[0]?.value || '';
    Object.defineProperty(select, 'value', { get: () => value, set: next => { value = String(next); } });
  }
  const state = { navigations: [], bodies: [], blobs: [], handlers: {}, timers: [] };
  const location = { origin, href: origin + '/' + page + search, search, assign: href => state.navigations.push(href) };
  const window = { document, location, TrainingModel: model,
    addEventListener: (name, cb) => { state.handlers[name] = cb; },
    dispatchEvent: event => state.handlers[event.type]?.(event) };
  class TestFormData extends Map {
    constructor(form) {
      super();
      for (const field of form.querySelectorAll('input[name],select[name],textarea[name]')) {
        if (field.disabled || (field.type === 'checkbox' && !field.checked)) continue;
        this.set(field.name, field.value || '');
      }
    }
  }
  class TestURL extends URL {
    static createObjectURL(blob) { state.blobs.push(blob); return 'blob:test'; }
    static revokeObjectURL() {}
  }
  const context = { window, document, location, Event, URL: TestURL, URLSearchParams, FormData: TestFormData,
    Blob, AbortController, console,
    history: { replaceState: (_, __, url) => { location.href = String(url); } },
    fetch: async (_, options) => { state.bodies.push(options.body); return { ok: true }; },
    setTimeout: cb => { state.timers.push(cb); return state.timers.length; }, clearTimeout: () => {},
    ...overrides };
  return { document, Event, state, location, context,
    run(file) { vm.runInNewContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context); } };
}

function familyForm(env) {
  env.run('family-register.js');
  const field = key => env.document.getElementById('family-' + key);
  const form = field('form');
  // Linkedom does not perform native form resets.
  form.reset = () => {};
  field('nickname').value = 'Лев & родина';
  field('email').value = 'parent@example.com';
  field('consent').checked = true;
  return { form, field, send: () => form.dispatchEvent(new env.Event('submit', { cancelable: true })) };
}

test('calculator booking prices follow the selected duration while the source calculation stays editable', () => {
  const config = model.preset('Dota 2', 'farm', 120);
  const destination = new URL(model.bookingFromCalculator(config), origin);
  assert.equal(destination.pathname, '/register.html');
  assert.equal(destination.hash, '#booking-options');
  const env = setup('register.html', destination.search);
  env.run('family-register.js');
  const get = id => env.document.getElementById(id);
  assert.equal(get('booking-game').value, 'Dota 2');
  assert.equal(get('booking-calculation').hidden, false);
  assert.match(get('booking-calculation-text').textContent, /Dota 2/);
  assert.match(get('booking-time-fit').textContent, /вміщується/);
  const format = get('booking-format');
  format.value = 'group';
  format.dispatchEvent(new env.Event('change'));
  assert.equal(get('booking-lesson-duration').value, '120');
  assert.match(get('booking-inline-total').textContent, /620 грн/);
  const duration = get('booking-lesson-duration');
  duration.value = '135';
  duration.dispatchEvent(new env.Event('change'));
  assert.match(get('booking-time-fit').textContent, /135 хв/);
  assert.match(get('booking-inline-total').textContent, /700 грн/);
  assert.match(get('booking-price-breakdown').textContent, /80 грн/);
  const edit = new URL(get('booking-edit-calculation').getAttribute('href'), origin);
  assert.deepEqual(model.parse(edit.search), model.parse(model.serialize(config)));
  const game = get('booking-game');
  game.value = 'CS2';
  game.dispatchEvent(new env.Event('change'));
  assert.equal(get('booking-calculation').hidden, true);
});

test('training requests include the selected package and adult contact, preserve data on failure and confirm after retry', async () => {
  const calls = [];
  const env = setup('register.html', '?game=Dota+2&format=group&package=progress&applicant=parent', { fetch: async (url, options) => {
    calls.push([url, options.method, Object.fromEntries(options.body)]);
    return { ok: calls.length > 1 };
  } });
  const { form, field, send } = familyForm(env);
  assert.equal(form.hidden, false);
  assert.equal(form.querySelector('input[type=password]'), null);
  send();
  send();
  await flush();
  assert.deepEqual(calls, [['/', 'POST', {
    'form-name': 'family-registration', 'family-name': 'Лев & родина', email: 'parent@example.com',
    game: 'Dota 2', format: 'Мала група', duration: '120', package: 'Прогрес · 8 занять',
    applicant: 'Для дитини (від дорослого)', 'bot-field': ''
  }]]);
  assert.equal(field('submit-error').hidden, false);
  assert.equal(field('success').hidden, true);
  assert.equal(field('email').value, 'parent@example.com');
  assert.equal(form.querySelector('button[type="submit"]').disabled, false);
  send();
  await flush();
  assert.equal(calls.length, 2);
  assert.equal(field('success').hidden, false);
  assert.equal(form.hidden, true);
  send();
  await flush();
  assert.equal(calls.length, 2);
});

test('booking shows an explicit fallback instead of using a conflicting or invalid query choice', () => {
  for (const search of ['?game=CS2&game=Valorant', '?duration=121', '?format=group&package=unknown']) {
    const env = setup('register.html', search);
    env.run('family-register.js');
    const get = id => env.document.getElementById(id);
    assert.equal(get('booking-link-warning').hidden, false);
    assert.equal(get('booking-game').value, 'CS2');
    assert.equal(get('booking-lesson-duration').value, '120');
    assert.equal(get('booking-format').value, 'individual');
  }
});

test('preview host calculates the package and carries it over without accepting contacts', async () => {
  const env = setup('register.html');
  env.location.origin = 'http://localhost:5500';
  const { form, field, send } = familyForm(env);
  const booking = key => env.document.getElementById('booking-' + key);
  assert.equal(form.hidden, false);
  assert.equal(field('contacts').hidden, true);
  assert.equal(field('contacts').disabled, true);
  assert.equal(field('unavailable').hidden, false);
  assert.equal(field('success').hidden, true);
  booking('game').value = 'Valorant';
  booking('format').value = 'group';
  booking('lesson-duration').value = '135';
  const trial = form.querySelector('[value="intro"]');
  const base = form.querySelector('[value="base"]');
  trial.checked = false;
  base.checked = true;
  base.dispatchEvent(new env.Event('change'));
  assert.match(booking('total').textContent, /2\s540 грн/);
  assert.match(booking('unit').textContent, /635 грн/);
  assert.match(booking('duration').textContent, /4 заняття × 2 год 15 хв/);
  assert.match(booking('plan').textContent, /укриття/);
  const live = new URL(booking('live-link').getAttribute('href'));
  assert.equal(live.origin, origin);
  assert.equal(live.searchParams.get('package'), 'base');
  assert.equal(live.searchParams.get('duration'), '135');
  assert.equal(live.searchParams.get('game'), 'Valorant');
  send();
  await flush();
  assert.equal(env.state.bodies.length, 0);
});

test('family request does not submit when required consent or email is invalid', async () => {
  const env = setup('register.html');
  const { field, send } = familyForm(env);
  field('consent').checked = false;
  field('email').value = 'wrong';
  send();
  await flush();
  assert.equal(field('email-error').hidden, false);
  assert.equal(field('consent-error').hidden, false);
  assert.equal(env.state.bodies.length, 0);
});

test('catalog restores game and skill, then refreshes the skills when the game changes', () => {
  const env = setup('coaches.html', '?game=Valorant&focus=team');
  env.run('catalog.js');
  const visible = () => [...env.document.querySelectorAll('#coaches article:not([hidden])')]
    .map(card => card.getAttribute('aria-labelledby'));
  const focus = env.document.getElementById('filter-focus');
  const skills = () => [...focus.options].map(option => option.value);
  assert.deepEqual(visible(), ['val-team-title']);
  assert.deepEqual(skills(), ['all', 'team', 'abilities', 'position']);

  const dota = env.document.querySelector('input[value="Dota 2"]');
  dota.dispatchEvent(new env.Event('change'));
  assert.deepEqual(visible(), ['dota-lane-title']);
  assert.deepEqual(skills(), ['all', 'map']);
  assert.equal(focus.value, 'all');
  assert.equal(new URL(env.location.href).searchParams.get('focus'), null);

  focus.value = 'map';
  focus.dispatchEvent(new env.Event('change'));
  assert.equal(new URL(env.location.href).searchParams.get('focus'), 'map');

  env.document.getElementById('catalog-form').dispatchEvent(new env.Event('reset', { cancelable: true }));
  assert.equal(visible().length, 4);
  assert.equal(new URL(env.location.href).search, '');
});

test('catalog ignores legacy channel filters and leaves the separate channels visible', () => {
  const env = setup('coaches.html', '?game=CS2&focus=abilities&kind=channel&platform=twitch&q=leb1ga');
  env.run('catalog.js');
  assert.equal(env.document.querySelectorAll('#coaches article:not([hidden])').length, 1);
  assert.equal(env.document.querySelectorAll('#gaming-channels article:not([hidden])').length, 4);
  assert.equal(env.document.getElementById('catalog-availability').textContent, 'Показано прикладів: 1 із 4.');
  assert.equal(new URL(env.location.href).search, '?game=CS2');
});

test('each training module opens its own calculator preset and receives a link back from results', () => {
  const { document } = setup('training.html');
  const modules = [...document.querySelectorAll('.program-module')];
  assert.equal(modules.length, 9);
  for (const module of modules) {
    const href = module.querySelector('a[href^="calculator.html?"]').getAttribute('href');
    const search = new URL(href, 'https://example.test').search;
    const {game, focus} = model.parse(search);
    const config = model.normalize(model.preset(game, focus));
    assert.equal(config.matchLength, model.games[config.game].matchLength);
    assert.equal(config.mode, 'budget');
    const results = setup('results.html', '?' + model.serialize(config));
    results.run('results.js');
    assert.equal(results.document.getElementById('practice-game-link').getAttribute('href'), 'training.html#' + module.id);
  }
});

test('a direct link expands only the requested module on arrival', () => {
  const env = setup('training.html');
  env.location.hash = '#dota-2-farm';
  env.run('programs.js');
  assert.equal(env.document.querySelector('#dota-2-farm details').open, true);
  assert.equal(env.document.querySelector('#dota-2-lane details').hasAttribute('open'), false);
});

test('a one-minute warmup does not recommend an exercise or replay review', () => {
  const env = setup('results.html', '?' + model.serialize({ ...model.defaults, mode: 'budget', budget: 1 }));
  env.run('results.js');
  assert.equal(env.document.getElementById('results-title').textContent, 'План розминки');
  assert.match(env.document.getElementById('focus-advice').textContent, /лише розминка/);
  assert.match(env.document.getElementById('practice-during').textContent, /Виконайте розминку/);
  assert.equal(env.document.getElementById('practice-review-card').hidden, true);
});

test('result states handle no parameters, bad parameters and a real plan', () => {
  for (const search of ['', '?mode=bad']) {
    const env = setup('results.html', search); env.run('results.js');
    assert.equal(env.document.getElementById('results-content').hidden, true);
    assert.equal(env.document.getElementById('results-empty').hidden, false);
    assert.equal(env.document.getElementById('app-load-status').hidden, true);
  }
  const config = { ...model.defaults, matches: 1, days: 1 };
  const env = setup('results.html', '?' + model.serialize(config)); env.run('results.js');
  assert.equal(env.document.getElementById('results-content').hidden, false);
  assert.equal(env.document.getElementById('metric-session').textContent, '1 год 30 хв');
  assert(env.document.getElementById('plan-summary').textContent.startsWith('1 повний матч'));
  assert(env.document.getElementById('results-intro').textContent.includes('1 заняття'));
  assert.deepEqual([...env.document.querySelectorAll('#session-blocks dt')].map(x => x.textContent), ['Розминка', 'Вправи', 'Пошук матчу', 'Матч', 'Розбір і висновки']);
  assert.equal(env.document.querySelectorAll('#weekly-sessions > li').length, 1);
  assert(env.document.querySelector('[data-edit-plan]').href.includes('matches=1'));
});

test('example results are marked and a skill-only plan has no match time', () => {
  const example = setup('results.html', '?example=1'); example.run('results.js');
  assert.equal(example.document.getElementById('example-note').hidden, false);
  const env = setup('results.html', '?' + model.serialize({ ...model.defaults, mode: 'budget', budget: 25 }));
  env.run('results.js');
  assert.equal(env.document.getElementById('metric-session').textContent, '25 хв');
  assert.equal(env.document.getElementById('metric-matches').textContent, '0');
  assert(env.document.getElementById('shortened-note').textContent.includes('Розбір: 15 хв → 0 хв'));
});

test('downloaded plan contains the current calculation and a valid edit link', async () => {
  const env = setup('results.html', '?example=1'); env.run('results.js');
  env.document.getElementById('download-plan').click();
  assert.equal(env.state.blobs.length, 1);
  const text = await env.state.blobs[0].text();
  assert(text.includes('Разом за заняття: 2 год 25 хв'));
  assert(text.includes('Редагування: ' + origin + '/calculator.html?mode=matches'));
});

test('Instagram without file sharing keeps the result page and offers selectable plan text', () => {
  const env = setup('results.html', '?example=1');
  env.context.window.navigator = { userAgent: 'iPhone Instagram' };
  env.run('results.js');
  env.document.getElementById('download-plan').click();
  assert.equal(env.state.blobs.length, 0);
  assert.equal(env.document.getElementById('plan-copy-fallback').hidden, false);
  assert(env.document.getElementById('plan-copy-text').value.includes('2 год 25 хв'));
});

test('native file sharing receives the text plan, without opening a Blob page', async () => {
  const env = setup('results.html', '?example=1', { File });
  let shared;
  env.context.window.navigator = { canShare: ({ files }) => files.length === 1, share: async ({ files }) => { shared = files[0]; } };
  env.run('results.js');
  env.document.getElementById('download-plan').click();
  await flush();
  assert.equal(env.state.blobs.length, 0);
  assert.equal(shared.name, 'kiberlviv-training-plan.txt');
  assert((await shared.text()).includes('2 год 25 хв'));
});

test('clipboard denial leaves the full plan available for manual copying', async () => {
  const env = setup('results.html', '?example=1');
  env.context.window.navigator = { clipboard: { writeText: async () => { throw new Error('denied'); } } };
  env.run('results.js');
  env.document.getElementById('copy-plan').click();
  await flush();
  assert.equal(env.document.getElementById('plan-copy-fallback').hidden, false);
  assert(env.document.getElementById('plan-copy-text').value.includes('2 год 25 хв'));
});

function contact(values = {}, overrides = {}, demo = false) {
  const env = setup('contact.html', '', overrides);
  if (demo) env.location.origin = 'http://localhost';
  const get = id => env.document.getElementById('contact-' + id);
  const form = get('form'), dialog = get('dialog');
  let focused = '';
  const valid = {name: 'Ан', email: 'test@example.invalid',
    subject: 'calculator', message: '1234567890', privacy: true, ...values};
  for (const [id,value] of Object.entries(valid)) {
    get(id)[id === 'privacy' ? 'checked' : 'value'] = value;
    get(id).focus = () => { focused = id; };
  }
  form.reset = () => {
    for (const id of Object.keys(valid)) get(id)[id === 'privacy' ? 'checked' : 'value'] = id === 'privacy' ? false : '';
  };
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new env.Event('close')); };
  const submit = () => form.dispatchEvent(new env.Event('submit', { cancelable: true }));
  env.run('contact.js');
  return { ...env, get, form, dialog, submit, focus: () => focused };
}

test('contact validates boundaries, email, topic and agreement', () => {
  for (const [id, value] of [['name','А'], ['email','name@local'], ['email','name@@example.org'],
    ['message','123456789'],
    ['message',' '.repeat(15)], ['message','x'.repeat(3001)], ['subject','unknown'], ['privacy',false]]) {
    const env = contact({[id]: value});
    env.submit();
    assert.equal(env.get(id).getAttribute('aria-invalid'), 'true', id + ': ' + value.slice?.(0,30));
    assert.equal(env.focus(), id);
    assert.equal(env.get(id + '-error').hidden, false);
    assert(!env.dialog.open);
  }
  const env = contact({ name:'А' });
  env.submit();
  env.get('name').value = 'Іван-Петро';
  env.get('name').dispatchEvent(new env.Event('input'));
  assert.equal(env.get('name').getAttribute('aria-invalid'), 'false');
  assert.equal(env.get('name-error').hidden, true);
});

test('contact on a mirror points to the official form without submitting locally', () => {
  const env = contact({}, {}, true);
  env.submit();
  assert.equal(env.state.bodies.length, 0);
  assert.equal(env.dialog.open, undefined);
  assert.equal(env.get('fields').hidden, true);
  assert.match(env.get('primary-link').href, /netlify\.app\/contact\.html/);
});

test('contact sends encoded data only once and resets after acceptance', async () => {
  let complete, calls = 0, body;
  const env = contact({ message: 'Перевірка калькулятора: & + ?' },
    { fetch: (_,options) => { calls++; body = options.body; return new Promise(resolve => { complete = resolve; }); } });
  env.submit(); env.submit();
  assert.equal(calls, 1);
  assert(!env.dialog.open);
  const params = new URLSearchParams(body);
  assert.equal(params.get('message'), 'Перевірка калькулятора: & + ?');
  assert.equal(params.has('phone'), false);
  assert.equal(params.get('privacy'), 'accepted');
  assert.equal(params.get('form-name'), 'contact');
  complete({ok:true}); await flush();
  assert.equal(env.dialog.open, true);
  assert.equal(env.get('message').value, '');
});

test('live reviews send a validated score and do not make a browser draft', async () => {
  const drafts = [];
  const env = contact({ subject: 'review', rating: '5' }, { localStorage: { setItem: (...args) => drafts.push(args) } });
  env.submit();
  await flush();
  assert.equal(new URLSearchParams(env.state.bodies[0]).get('rating'), '5');
  assert.equal(new URLSearchParams(env.state.bodies[0]).get('subject'), 'review');
  assert.equal(env.dialog.open, true);
  assert.equal(env.get('review-link').hidden, true);
  assert.deepEqual(drafts, []);
});

test('contact rejection keeps input, restores submit and does not show success', async () => {
  const env = contact({ message: 'Збережіть моє повідомлення' }, { fetch: async () => ({ok:false}) });
  env.submit(); await flush();
  assert.equal(env.get('message').value, 'Збережіть моє повідомлення');
  assert(!env.dialog.open);
  assert.equal(env.form.querySelector('button').disabled, false);
  assert.match(env.get('status').textContent, /Не вдалося/);
});

test('application status exposes a script failure and clears after initialization', () => {
  const env = setup('calculator.html'); env.run('app-status.js');
  env.state.handlers.error({ target: { tagName: 'SCRIPT' } });
  const status = env.document.getElementById('app-load-status');
  assert.equal(status.hidden, false); assert(status.textContent.includes('Не вдалося'));
  env.state.handlers['kiberlviv:ready'](); assert.equal(status.hidden, true);
});

test('Ukrainian count labels cover singular, few and teen exceptions', () => {
  const c = value => model.count(value, 'матч', 'матчі', 'матчів');
  assert.deepEqual([0, 1, 2, 5, 11, 12, 21, 24, 111].map(c),
    ['0 матчів', '1 матч', '2 матчі', '5 матчів', '11 матчів', '12 матчів', '21 матч', '24 матчі', '111 матчів']);
});
