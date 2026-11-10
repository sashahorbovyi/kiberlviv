(() => {
  const key = 'kiberlviv-theme';
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  let choice = null;
  try { choice = localStorage.getItem(key); } catch { /* Storage can be unavailable. */ }
  if (choice !== 'light' && choice !== 'dark') choice = null;

  function apply() {
    const theme = choice || (system.matches ? 'dark' : 'light');
    root.dataset.theme = theme;
    const toggle = document.querySelector('[data-theme-toggle]');
    if (toggle) {
      const dark = theme === 'dark';
      toggle.setAttribute('aria-pressed', String(dark));
      toggle.title = dark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему';
    }
  }

  // Resolve the colors before the stylesheets paint the page.
  apply();
  function bind() {
    const toggle = document.querySelector('[data-theme-toggle]');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      choice = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, choice); } catch { /* Apply for this page. */ }
      apply();
    });
    apply();
    toggle.hidden = false;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
  system.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    choice = event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : null;
    apply();
  });
})();
