const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/theme.js'), 'utf8');

function startTheme({ saved, dark = false, blocked = false } = {}) {
  const dataset = {};
  const events = {};
  const toggle = {
    hidden: true,
    setAttribute(name, value) { this[name] = value; },
    addEventListener(name, callback) { events[name] = callback; }
  };
  const system = {
    matches: dark,
    addEventListener(name, callback) { events[name] = callback; }
  };
  let ready = false;
  vm.runInNewContext(source, {
    document: {
      documentElement: { dataset }, readyState: 'loading',
      querySelector: () => ready ? toggle : null,
      addEventListener: (_, callback) => { events.ready = callback; }
    },
    matchMedia: () => system,
    localStorage: {
      getItem: () => { if (blocked) throw new Error('Unavailable'); return saved; },
      setItem: (key, value) => { if (blocked) throw new Error('Unavailable'); assert.equal(key, 'kiberlviv-theme'); saved = value; }
    },
    window: { addEventListener: (name, callback) => { events[name] = callback; } }
  });
  return { dataset, toggle, system, events, saved: () => saved, ready: () => { ready = true; events.ready(); } };
}

test('uses the system before rendering and preserves an explicit choice across pages', () => {
  const first = startTheme({ dark: true });
  assert.equal(first.dataset.theme, 'dark');
  first.ready();
  assert.equal(first.toggle.hidden, false);
  assert.equal(first.toggle['aria-pressed'], 'true');
  first.events.click();
  assert.equal(first.toggle['aria-pressed'], 'false');
  const second = startTheme({ saved: first.saved(), dark: true });
  assert.equal(second.dataset.theme, 'light');
  second.ready();
  second.events.storage({ key: 'kiberlviv-theme', newValue: 'dark' });
  assert.equal(second.dataset.theme, 'dark');
  assert.equal(second.toggle['aria-pressed'], 'true');
});

test('invalid or unavailable storage does not prevent theme selection', () => {
  assert.equal(startTheme({ saved: 'unknown', dark: true }).dataset.theme, 'dark');
  const page = startTheme({ blocked: true });
  page.ready();
  page.system.matches = true;
  page.events.change();
  assert.equal(page.dataset.theme, 'dark');
  page.events.click();
  assert.equal(page.dataset.theme, 'light');
});
