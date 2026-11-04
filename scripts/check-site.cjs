const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { parseHTML } = require('linkedom');
const postcss = require('postcss');
const root = path.resolve(__dirname, '..');
const origin = 'https://gilded-rabanadas-6b2d18.netlify.app';
const files = fs.readdirSync(root).filter(name => name.endsWith('.html'));
const docs = new Map(files.map(name => [name, parseHTML(fs.readFileSync(path.join(root, name), 'utf8')).document]));
for (const [name, doc] of docs) {
  assert.equal(doc.documentElement.lang, 'uk', name);
  assert.equal(doc.querySelectorAll('head > title').length, 1, name);
  assert(doc.querySelector('meta[name="description"]'), name);
  assert(doc.querySelector('meta[http-equiv="Content-Security-Policy"]'), name);
  assert(doc.querySelector('a.skip-link[href="#main-content"]'), name);
  assert(doc.querySelector('main#main-content[tabindex="-1"]'), name);
  const ids = [...doc.querySelectorAll('[id]')].map(el => el.id);
  assert.equal(new Set(ids).size, ids.length, `Duplicate IDs in ${name}`);
  for (const el of doc.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls]')) {
    for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls']) {
      for (const id of (el.getAttribute(attr) || '').split(/\s+/).filter(Boolean)) assert(ids.includes(id), `${name}: missing ${id}`);
    }
  }
  for (const img of doc.querySelectorAll('img')) {
    for (const attr of ['alt', 'width', 'height']) assert(img.hasAttribute(attr), `${name}: image missing ${attr}`);
  }
  for (const el of doc.querySelectorAll('a[target="_blank"]')) assert(el.rel.includes('noopener'), name);
  for (const input of doc.querySelectorAll('input:not([type="hidden"]),select,textarea')) {
    assert(input.closest('label') || input.hasAttribute('aria-label') || doc.querySelector(`label[for="${input.id}"]`), `${name}: missing field label`);
  }
  for (const attr of ['href', 'src', 'data-src', 'poster']) {
    for (const el of doc.querySelectorAll(`[${attr}]`)) {
      const value = el.getAttribute(attr);
      const url = new URL(value, `${origin}/${name}`);
      if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) continue;
      const target = decodeURIComponent(url.pathname.slice(1)) || 'index.html';
      const absolute = path.resolve(root, target);
      assert(absolute.startsWith(root + path.sep), `${name}: unexpected path`);
      assert(fs.statSync(absolute).isFile(), `${name}: missing ${value}`);
      if (url.hash && docs.has(target)) assert(docs.get(target).getElementById(decodeURIComponent(url.hash.slice(1))), `${name}: missing fragment ${value}`);
    }
  }
  const expected = name === 'index.html' ? origin + '/' : origin + '/' + name;
  assert.equal(doc.querySelector('link[rel="canonical"]').href, expected, name);
  assert.equal(doc.querySelectorAll('footer a[href="contact.html"]').length, name === '404.html' ? 0 : 1, name);
  if (['results.html', 'contact-success.html', '404.html'].includes(name)) assert(doc.querySelector('meta[name="robots"]').content.includes('noindex'), name);
}
for (const name of fs.readdirSync(path.join(root, 'css')).filter(name => name.endsWith('.css'))) {
  const css = fs.readFileSync(path.join(root, 'css', name), 'utf8');
  postcss.parse(css, { from: name });
  for (const match of css.matchAll(/url\(["']?([^\)"']+)/g)) {
    if (/^(https?:|data:)/.test(match[1])) continue;
    assert(fs.existsSync(path.resolve(root, 'css', decodeURIComponent(match[1]))), `Missing CSS asset ${match[1]}`);
  }
}
console.log(`PASS: ${files.length} pages, local links, fragments, field labels, ARIA, metadata, dimensions and CSS syntax.`);
