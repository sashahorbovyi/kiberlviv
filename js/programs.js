(() => {
  function revealModule() {
    const id = location.hash.slice(1);
    const module = document.getElementById(id);
    if (!module?.classList.contains('program-module')) return;
    const details = module.querySelector('.program-details');
    if (details) details.open = true;
  }

  revealModule();
  window.addEventListener('hashchange', revealModule);
})();
