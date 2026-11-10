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
  const practiceSections = { CS2: 'cs2', 'Dota 2': 'dota-2', Valorant: 'valorant' };
  const practiceLink = document.getElementById('practice-game-link');
  const practiceSection = practiceSections[config.game];
  const practiceAnchor = config.game === 'Valorant' && config.focus === 'mechanics'
    ? practiceSection : `${practiceSection}-${config.focus}`;
  practiceLink.href = `training.html#${practiceAnchor}`;
  practiceLink.textContent = practiceAnchor === practiceSection
    ? 'Усі модулі для цієї гри →' : 'Відкрити модуль за твоєю навичкою →';
  const put = (id, text) => { document.getElementById(id).textContent = text; };
  const fmt = model.format;
  const [focusTitle, focusTip] = model.games[config.game].focuses[config.focus];
  const onlyWarmup = !result.matches && !result.drills && !result.review;
  let advice = focusTip;
  if (onlyWarmup) {
    advice = 'У плані є лише розминка. Зміни тривалість блоків або збільш доступний час, якщо хочеш додати вправу.';
    put('practice-before', 'Підготуй знайому дію для розминки.');
    put('practice-during', 'Виконай розминку у спокійному темпі.');
    put('practice-after', 'Відміть, чи вистачило часу на розминку.');
  } else if (!result.matches) {
    advice = result.drills
      ? 'Виконай цільову вправу без матчу. Порівняй повтори в однакових умовах.'
      : 'У плані є розбір, тож обери один епізод із попереднього матчу й визнач, що зміниш наступного разу.';
    put('practice-during', result.drills ? 'Повтори вправу в тих самих умовах і порівняй дві спроби.' : 'Переглянь епізод і назви одне рішення, яке можна змінити.');
    if (!result.drills) put('practice-before', 'Вибери запис попереднього матчу.');
    if (!result.review) put('practice-after', 'Відміть, чи вдалося виконати вправу в межах часу.');
  } else if (!result.drills || !result.review) {
    advice = 'У матчі звертай увагу на одну дію, пов’язану з обраною навичкою.';
    if (!result.review) put('practice-after', 'Заверши заняття після запланованого останнього матчу.');
  }
  if (!result.review) document.getElementById('practice-review-card').hidden = true;
  put("results-badge", example ? "Приклад розрахунку" : "Твій розрахунок");
  put("results-title", result.matches ? "Твій тренувальний план" : onlyWarmup ? "План розминки" : result.drills ? "Заняття на окрему навичку" : "План розбору гри");
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
  put("focus-title", onlyWarmup ? "Розминка" : focusTitle);
  put("focus-advice", advice);
  const schedule = document.getElementById("weekly-sessions");
  for (let i = 1; i <= config.days; i++) {
    const row = document.createElement("li");
    const title = document.createElement("strong"); title.textContent = `Заняття ${i}`;
    const detail = document.createElement("span"); detail.textContent = `${fmt(result.total)} · матчів: ${result.matches}`;
    row.append(title, detail); schedule.append(row);
  }
  put("weekly-summary", `Разом: ${fmt(result.weeklyTotal)}, із них ${fmt(result.weeklyActive)} на розминку, вправи, матчі й аналіз. Дні проведення обираєш самостійно.`);
  const text = [example ? "КіберЛьвів — приклад плану" : "КіберЛьвів — тренувальний план",
    `${config.game}; фокус: ${model.games[config.game].focuses[config.focus][0]}`,
    `Занять на тиждень: ${config.days}`, "", "Одне заняття:",
    ...blocks.map(([title, time]) => `${title}: ${fmt(time)}`),
    `Разом за заняття: ${fmt(result.total)}`, `Разом за тиждень: ${fmt(result.weeklyTotal)}`,
    `Тренувальний час за тиждень: ${fmt(result.weeklyActive)}`,
    `Нерозподілений час на заняття: ${fmt(result.remaining)}`,
    "", advice,
    "", "Це планувальна модель, а не прогноз рангу або оцінка безпечності навантаження.",
    `Редагування: ${new URL(`calculator.html?${query}`, window.location.href).href}`].join("\n");
  const download = document.getElementById("download-plan");
  const fallback = document.getElementById("plan-copy-fallback");
  const copyField = document.getElementById("plan-copy-text");
  const nav = window.navigator || {};
  const filename = "kiberlviv-training-plan.txt";
  const type = "text/plain;charset=utf-8";
  const likelyEmbedded = /Instagram|FBAN|FBAV|FBIOS|FB_IAB/i.test(nav.userAgent || "");
  const isIOS = /iPhone|iPad|iPod/i.test(nav.userAgent || "") ||
    (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);

  function showPlanText(message) {
    copyField.value = text;
    fallback.hidden = false;
    put("download-status", message);
    copyField.focus();
    copyField.select?.();
  }

  document.getElementById("copy-plan").addEventListener("click", async () => {
    try {
      await nav.clipboard.writeText(text);
      put("download-status", "План скопійовано.");
    } catch {
      showPlanText("Автоматичне копіювання недоступне. Скопіюй текст вручну.");
    }
  });

  download.addEventListener("click", async () => {
    if (typeof File === "function" && typeof nav.share === "function" && typeof nav.canShare === "function") {
      try {
        const files = [new File(["\uFEFF", text], filename, { type })];
        if (nav.canShare({ files })) {
          await nav.share({ files });
          return;
        }
      } catch (error) {
        if (error?.name === "AbortError") return;
        showPlanText("Не вдалося відкрити меню поширення. План можна скопіювати нижче.");
        return;
      }
    }

    // Some mobile browsers preview a Blob instead of honoring the download attribute.
    if (likelyEmbedded || isIOS) {
      showPlanText("Цей браузер може відкривати файл замість завантаження. План доступний для копіювання нижче.");
      return;
    }

    const url = URL.createObjectURL(new Blob(["\uFEFF", text], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    put("download-status", "План підготовлено до завантаження у текстовому файлі.");
  });
})();
