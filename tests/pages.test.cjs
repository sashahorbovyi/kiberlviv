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

test('catalog supports game filtering, empty state, reset and URL restoration', () => {
  const env = setup('coaches.html', '?game=CS2'); env.run('catalog.js');
  const cards = [...env.document.querySelectorAll('article[data-game]')];
  const visible = () => cards.filter(card => !card.hidden);
  assert.equal(visible().length, 2);
  assert(visible().every(card => card.dataset.game === 'CS2'));
  const select = env.document.getElementById('filter-game');
  select.value = 'Valorant'; select.dispatchEvent(new env.Event('change'));
  assert.equal(visible().length, 0); assert.equal(env.document.getElementById('catalog-empty').hidden, false);
  env.document.getElementById('catalog-form').dispatchEvent(new env.Event('reset', { cancelable: true }));
  assert.equal(visible().length, 4); assert.equal(env.document.getElementById('catalog-empty').hidden, true);
  assert(!env.location.href.includes('game='));
});

test('unknown catalog filter leaves all profiles visible', () => {
  const env = setup('coaches.html', '?game=unknown'); env.run('catalog.js');
  assert.equal(env.document.querySelectorAll('article[data-game]:not([hidden])').length, 4);
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
  assert.equal(env.document.querySelectorAll('#session-blocks > div').length, 6);
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
  assert(env.document.getElementById('shortened-note').textContent.includes('скорочені'));
});

test('downloaded plan contains the current calculation and a valid edit link', async () => {
  const env = setup('results.html', '?example=1'); env.run('results.js');
  env.document.getElementById('download-plan').click();
  assert.equal(env.state.blobs.length, 1);
  const text = await env.state.blobs[0].text();
  assert(text.includes('Разом за заняття: 2 год 25 хв'));
  assert(text.includes('Редагування: ' + origin + '/calculator.html?mode=matches'));
});

test('contact submission sends encoded data once and waits for acceptance', async () => {
  let complete, calls = 0, body;
  const env = setup('contact.html', '', { fetch: (_, options) => { calls++; body = options.body; return new Promise(resolve => { complete = resolve; }); } });
  const form = env.document.getElementById('contact-form'); form.reportValidity = () => true;
  env.document.getElementById('contact-email').value = 'test@example.invalid';
  env.document.getElementById('contact-message').value = 'Перевірка калькулятора: & + ?';
  env.run('contact.js');
  form.dispatchEvent(new env.Event('submit', { cancelable: true }));
  form.dispatchEvent(new env.Event('submit', { cancelable: true }));
  assert.equal(calls, 1); assert.equal(env.state.navigations.length, 0);
  assert.equal(new URLSearchParams(body).get('message'), 'Перевірка калькулятора: & + ?');
  assert.equal(new URLSearchParams(body).get('form-name'), 'contact');
  complete({ ok: true }); await flush();
  assert.deepEqual(env.state.navigations, [origin + '/contact-success.html']);
});

test('contact rejection keeps input, restores submit and does not show success', async () => {
  const env = setup('contact.html', '', { fetch: async () => ({ ok: false }) });
  const form = env.document.getElementById('contact-form'); form.reportValidity = () => true;
  const input = env.document.getElementById('contact-message'); input.value = 'Збережіть моє повідомлення';
  env.run('contact.js'); form.dispatchEvent(new env.Event('submit', { cancelable: true })); await flush();
  assert.equal(input.value, 'Збережіть моє повідомлення');
  assert.equal(env.state.navigations.length, 0);
  assert.equal(form.querySelector('button').disabled, false);
  assert(env.document.getElementById('contact-status').textContent.includes('Не вдалося'));
});

test('contact mirror retains native cross-origin POST and invalid form does not send', () => {
  const env = setup('contact.html'); env.location.origin = 'https://sashahorbovyi.github.io'; env.run('contact.js');
  const event = new env.Event('submit', { cancelable: true });
  env.document.getElementById('contact-form').dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  const invalid = setup('contact.html'); invalid.document.getElementById('contact-form').reportValidity = () => false;
  invalid.run('contact.js'); invalid.document.getElementById('contact-form').dispatchEvent(new invalid.Event('submit', { cancelable: true }));
  assert.equal(invalid.state.bodies.length, 0);
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
