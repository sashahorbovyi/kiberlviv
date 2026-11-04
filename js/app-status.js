(() => {
  const status = document.getElementById('app-load-status');
  if (!status) return;
  const fail = () => {
    status.hidden = false;
    status.textContent = 'Не вдалося завантажити інтерактивну частину сторінки. Перевірте з’єднання та оновіть сторінку. Формула й приклад доступні на сторінці «Про проєкт».';
  };
  const timer = setTimeout(() => {
    if (document.documentElement.dataset.appReady !== 'true') fail();
  }, 8000);
  window.addEventListener('kiberlviv:ready', () => {
    clearTimeout(timer);
    status.hidden = true;
  });
  window.addEventListener('error', event => {
    const scriptFailed = event.target?.tagName === 'SCRIPT';
    const appFailed = /\/(calculator|results|training-model)\.js(?:\?|$)/.test(event.filename || '');
    if (scriptFailed || appFailed) { clearTimeout(timer); fail(); }
  }, true);
})();
