const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Unexpected build directory');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output);
const files = fs.readdirSync(root).filter(name => name.endsWith('.html'));
for (const name of [...files, 'robots.txt', 'sitemap.xml', '_headers', '.nojekyll']) {
  if (name !== '404.html') {
    fs.copyFileSync(path.join(root, name), path.join(output, name));
    continue;
  }
  // The built site is served from the host root. Keep recovery links working
  // even when a 404 is rendered at a deeply nested missing URL.
  const page = fs.readFileSync(path.join(root, name), 'utf8');
  const local = page.replace(/((?:href|src)=")https:\/\/gilded-rabanadas-6b2d18\.netlify\.app\/(?!(?:404)\.html")/g, '$1/');
  fs.writeFileSync(path.join(output, name), local);
}
for (const name of ['css', 'js', 'assets']) {
  fs.cpSync(path.join(root, name), path.join(output, name), { recursive: true });
}
console.log(`Built ${files.length} pages in dist/; source, tests and dependencies are excluded.`);
