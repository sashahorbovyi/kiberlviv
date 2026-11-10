(() => {
  const form = document.getElementById('catalog-form');
  if (!form) return;
  const games = [...form.querySelectorAll('input[name="game"]')];
  const focus = document.getElementById('filter-focus');
  const options = [...focus.options];
  const cards = [...document.querySelectorAll('#coaches article[data-game][data-focus]')];
  const status = document.getElementById('catalog-availability');
  const params = new URLSearchParams(location.search);

  function filter(game, requestedFocus) {
    for (const radio of games) radio.checked = radio.value === game;
    const available = cards.filter(card => game === 'all' || card.dataset.game === game);
    const skills = new Set(available.flatMap(card => card.dataset.focus.split(' ')));
    const choices = options.filter(option => option.value === 'all' || skills.has(option.value));
    focus.replaceChildren(...choices);
    focus.value = choices.some(option => option.value === requestedFocus) ? requestedFocus : 'all';

    let count = 0;
    for (const card of cards) {
      card.hidden = !available.includes(card) ||
        (focus.value !== 'all' && !card.dataset.focus.split(' ').includes(focus.value));
      if (!card.hidden) count++;
    }
    const message = `Показано прикладів: ${count} із ${cards.length}.`;
    if (status.textContent !== message) status.textContent = message;

    const url = new URL(location.href);
    for (const [key, value] of [['game', game], ['focus', focus.value]]) {
      if (value === 'all') url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    for (const key of ['kind', 'platform', 'q']) url.searchParams.delete(key);
    if (url.href !== location.href) history.replaceState(null, '', url);
  }

  const selectedGame = () => games.find(radio => radio.checked)?.value || 'all';
  for (const radio of games) radio.addEventListener('change', () => filter(radio.value, focus.value));
  focus.addEventListener('change', () => filter(selectedGame(), focus.value));
  form.addEventListener('reset', event => {
    event.preventDefault();
    filter('all', 'all');
  });

  const game = games.find(radio => radio.value === params.get('game'))?.value || 'all';
  filter(game, params.get('focus'));
  document.getElementById('catalog-controls').disabled = false;
})();
