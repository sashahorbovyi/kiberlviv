(() => {
  const form = document.getElementById('catalog-form');
  if (!form) return;
  const select = document.getElementById('filter-game');
  const cards = [...document.querySelectorAll('#coaches article[data-game]')];
  const status = document.getElementById('catalog-availability');
  const empty = document.getElementById('catalog-empty');
  const allowed = new Set([...select.options].map(option => option.value));
  const requested = new URLSearchParams(location.search).get('game');
  if (allowed.has(requested)) select.value = requested;
  function filter() {
    let count = 0;
    for (const card of cards) {
      card.hidden = select.value !== 'all' && card.dataset.game !== select.value;
      if (!card.hidden) count++;
    }
    empty.hidden = count !== 0;
    status.textContent = `Показано профілів: ${count} із ${cards.length}. ${select.value === 'all' ? 'Усі ігри.' : `Гра: ${select.value}.`}`;
    const url = new URL(location.href);
    if (select.value === 'all') url.searchParams.delete('game');
    else url.searchParams.set('game', select.value);
    history.replaceState(null, '', url);
  }
  select.addEventListener('change', filter);
  form.addEventListener('submit', event => { event.preventDefault(); filter(); });
  form.addEventListener('reset', event => {
    event.preventDefault();
    select.value = 'all';
    filter();
  });
  document.getElementById('catalog-controls').disabled = false;
  filter();
})();
