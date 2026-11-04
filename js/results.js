(function () {
  "use strict";
  const model = window.TrainingModel;
  if (!model) return;
  document.documentElement.dataset.appReady = "true";
  document.getElementById("app-load-status").hidden = true;
  window.dispatchEvent(new Event("kiberlviv:ready"));
  const params = model.parse(window.location.search);
  const example = params.example === "1";
  const empty = document.getElementById("results-empty");
  const content = document.getElementById("results-content");
  let result;
  try {
    if (!Object.keys(params).length) return;
    result = model.calculate(example ? model.defaults : params);
  } catch (_) {
    document.getElementById("empty-message").textContent = "Параметри розрахунку неповні або некоректні. Повернися до форми та перевір значення.";
    return;
  }
  empty.hidden = true; content.hidden = false;
  const { config } = result;
  const put = (id, text) => { document.getElementById(id).textContent = text; };
  const fmt = model.format;
  put("results-badge", example ? "Приклад розрахунку" : "Твій розрахунок");
  put("results-title", result.matches ? "Твій тренувальний план" : "Заняття на окрему навичку");
  put("results-intro", `${config.game} · ${model.count(config.days, "заняття", "заняття", "занять")} на тиждень · ${model.games[config.game].focuses[config.focus][0]}`);
  document.getElementById("example-note").hidden = !example;
  const query = model.serialize(config);
  document.querySelectorAll("[data-edit-plan]").forEach(link => { link.href = `calculator.html?${query}`; });
  put("metric-session", fmt(result.total)); put("metric-week", fmt(result.weeklyTotal));
  put("metric-active", fmt(result.weeklyActive)); put("metric-matches", String(result.weeklyMatches));
  put("plan-summary", result.matches
    ? `${model.count(result.matches, "повний матч", "повні матчі", "повних матчів")} за заняття. Тривалість матчу й очікування — твої планові оцінки; фактичний час може відрізнятися.`
    : "Повний матч разом із заданими підготовкою та розбором не вміщується. Нижче — заняття без матчів; ти можеш змінити блоки або збільшити доступний час.");
  put("budget-note", config.mode === "budget"
    ? `Доступно ${fmt(config.budget)}. Не розподілено: ${fmt(result.remaining)}. Залишок не перетворюємо на частину матчу.`
    : "Час перерв між матчами й очікування вже включено в повну тривалість.");
  const timeline = document.getElementById("session-blocks");
  const blocks = [["Розминка", result.warmup], ["Цільові вправи", result.drills],
    [`Матчі (${result.matches})`, result.matchTime], ["Аналіз і висновки", result.review],
    ["Очікування перед матчами", result.queueTime], ["Перерви між матчами", result.breaks]];
  for (const [title, time] of blocks) {
    const row = document.createElement("div"); row.className = "training-time-row";
    const label = document.createElement("dt"); label.textContent = title;
    const value = document.createElement("dd"); value.textContent = fmt(time);
    row.append(label, value); timeline.append(row);
  }
  put("shortened-note", result.shortened ? "Доступний час заповнено послідовно: спочатку розминка, потім вправи, потім аналіз. Останні блоки можуть бути скорочені або пропущені. Перевір розподіл і за потреби зміни тривалості." : "");
  put("focus-title", model.games[config.game].focuses[config.focus][0]);
  put("focus-advice", model.games[config.game].focuses[config.focus][1]);
  const schedule = document.getElementById("weekly-sessions");
  for (let i = 1; i <= config.days; i++) {
    const row = document.createElement("li");
    const title = document.createElement("strong"); title.textContent = `Заняття ${i}`;
    const detail = document.createElement("span"); detail.textContent = `${fmt(result.total)} · матчів: ${result.matches}`;
    row.append(title, detail); schedule.append(row);
  }
  put("weekly-summary", `Разом: ${fmt(result.weeklyTotal)}, із них ${fmt(result.weeklyActive)} на розминку, вправи, матчі й аналіз. Дні проведення обираєш самостійно.`);
  const download = document.getElementById("download-plan");
  download.addEventListener("click", function () {
    const text = [example ? "КіберЛьвів — приклад плану" : "КіберЛьвів — тренувальний план",
      `${config.game}; фокус: ${model.games[config.game].focuses[config.focus][0]}`,
      `Занять на тиждень: ${config.days}`, "", "Одне заняття:",
      ...blocks.map(([title, time]) => `${title}: ${fmt(time)}`),
      `Разом за заняття: ${fmt(result.total)}`, `Разом за тиждень: ${fmt(result.weeklyTotal)}`,
      `Тренувальний час за тиждень: ${fmt(result.weeklyActive)}`,
      `Нерозподілений час на заняття: ${fmt(result.remaining)}`,
      "", model.games[config.game].focuses[config.focus][1],
      "", "Це планувальна модель, а не прогноз рангу або оцінка безпечності навантаження.",
      `Редагування: ${new URL(`calculator.html?${query}`, window.location.href).href}`].join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "kiberlviv-training-plan.txt";
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    put("download-status", "План підготовлено до завантаження у текстовому файлі.");
  });
})();
