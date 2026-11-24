(function () {
  "use strict";
  const model = window.TrainingModel;
  const form = document.getElementById("calculator-form");
  if (!form || !model) return;
  const error = document.getElementById("calculator-error");
  const submit = document.getElementById("calculator-submit");
  const note = document.getElementById("training-live-note");
  const values = document.getElementById("training-live-values");
  const session = document.getElementById("training-live-session");
  const week = document.getElementById("training-live-week");
  const matches = document.getElementById("training-live-matches");
  const weekItem = document.getElementById("training-live-week-item");
  const steps = document.getElementById("training-live-steps");
  const exercise = document.getElementById("training-live-exercise");
  const errorAction = document.getElementById("training-error-action");
  const settings = document.getElementById("training-settings");
  const quick = document.getElementById("training-quick-summary");
  const threshold = document.getElementById("training-match-threshold");
  const addTime = document.getElementById("training-add-time");
  const reserveReview = document.getElementById("training-reserve-review");
  const openExercise = document.getElementById("training-open-exercise");
  const changes = document.getElementById("training-live-changes");
  const warning = document.getElementById("training-live-warning");
  const setup = document.getElementById("training-live-setup");
  const gameLengths = new Map();
  const presets = [...form.querySelectorAll("[data-budget]")];
  const control = name => form.elements.namedItem(name);
  let invalidInput;
  errorAction.addEventListener("click", () => {
    if (!invalidInput) return;
    const details = invalidInput.closest("details");
    if (details) details.open = true;
    invalidInput.focus();
  });
  function updateFocus(selected) {
    const game = control("game").value;
    const data = model.games[game];
    const select = control("focus");
    select.replaceChildren();
    for (const [key, [label]] of Object.entries(data.focuses)) {
      const option = document.createElement("option");
      option.value = key; option.textContent = label; select.append(option);
    }
    if (Object.hasOwn(data.focuses, selected)) select.value = selected;
  }
  function updateMode() {
    const budget = control("mode").value !== "matches";
    for (const [id, visible, name] of [["matches-field", !budget, "matches"], ["budget-field", budget, "budget"]]) {
      document.getElementById(id).hidden = !visible;
      control(name).disabled = !visible;
    }
  }
  const numeric = [...form.querySelectorAll('input[type="number"]')];
  const initial = model.preset();
  for (const input of numeric) {
    [input.min, input.max] = model.ranges[input.name];
    input.value = initial[input.name];
  }
  const messages = new Map(numeric.map(input => {
    const message = document.createElement("p");
    message.id = `training-field-error-${input.id}`;
    message.className = "training-inline-error";
    message.hidden = true;
    input.parentElement.append(message);
    const described = input.getAttribute("aria-describedby");
    input.setAttribute("aria-describedby", [described, message.id].filter(Boolean).join(" "));
    return [input, message];
  }));
  function refresh() {
    const game = control("game").value;
    document.getElementById("calculator-program-link").href = model.programLink(game);
    document.getElementById("calculator-booking-link").href = model.bookingLink(game);
    quick.textContent = threshold.textContent = setup.textContent = "";
    addTime.hidden = reserveReview.hidden = openExercise.hidden = changes.hidden = warning.hidden = true;
    for (const button of presets) button.setAttribute("aria-pressed", String(button.dataset.budget === control("budget").value));
    invalidInput = null;
    for (const [input, message] of messages) {
      const bad = !input.disabled && (!input.validity.valid || !/^\d+$/.test(input.value));
      if (bad) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
      message.hidden = !bad;
      message.textContent = bad ? `Введіть ціле число від ${input.min} до ${input.max}.` : "";
      if (bad && !invalidInput) invalidInput = input;
    }
    errorAction.hidden = !invalidInput;
    try {
      if (invalidInput) {
        const label = invalidInput.labels[0].textContent.trim().replace(/^\d+\.\s*/, "");
        throw new Error(`Перевірте поле «${label}»: потрібне ціле число від ${invalidInput.min} до ${invalidInput.max}.`);
      }
      const plan = model.calculate(Object.fromEntries(new FormData(form)));
      session.textContent = model.format(plan.total);
      week.textContent = model.format(plan.weeklyTotal);
      matches.textContent = String(plan.matches);
      weekItem.hidden = plan.config.days === 1;
      const items = model.steps(plan).map(([label, minutes]) => {
        const item = document.createElement("li");
        item.textContent = `${label} — ${model.format(minutes)}`;
        return item;
      });
      steps.replaceChildren(...items);
      const [skill, tip] = model.games[plan.config.game].focuses[plan.config.focus];
      exercise.textContent = plan.drills
        ? `Фокус: ${skill}. ${plan.matches && plan.review ? tip : "Відпрацюйте одну дію з цієї навички у тренувальному режимі."}`
        : "";
      exercise.hidden = !plan.drills;
      steps.hidden = false;
      const remaining = plan.remaining ? ` Запас: ${model.format(plan.remaining)}.` : "";
      const fmt = model.format;
      const count = plan.matches ? model.count(plan.matches, "матч", "матчі", "матчів") : "без матчу";
      quick.textContent = `Орієнтовний план: ${fmt(plan.total)} · ${count}${plan.remaining ? " · запас " + fmt(plan.remaining) : ""}.`;
      if (plan.config.mode === "budget") {
        threshold.textContent = `Одне заняття з матчем за цих налаштувань — від ${fmt(plan.firstMatchMinutes)}.`;
        if (!plan.matches && plan.firstMatchMinutes <= model.ranges.budget[1]) {
          addTime.textContent = `Додати ${fmt(plan.firstMatchMinutes - plan.config.budget)} для матчу`;
          addTime.dataset.budget = plan.firstMatchMinutes;
          addTime.hidden = false;
        }
      }
      const cfg = plan.config;
      setup.textContent = `Налаштування: розминка ${fmt(cfg.warmup)} · вправи ${fmt(cfg.drills)} · розбір ${fmt(cfg.review)}${cfg.mode === "drills" ? "" : ` · матч ${fmt(cfg.matchLength)} · пошук ${fmt(cfg.queue)} · перерва ${fmt(cfg.breakMinutes)}`}.`;
      const cut = model.reductions(plan);
      changes.textContent = cut.length ? "Скорочено: " + cut.join("; ") + "." : "";
      changes.hidden = !cut.length;
      warning.textContent = model.volumeWarning(plan);
      warning.hidden = !warning.textContent;
      if (plan.shortened && !plan.matches && plan.review < Math.min(5, cfg.review) && plan.drills > 5) {
        const review = Math.min(5, cfg.review);
        const drills = plan.drills - (review - plan.review);
        reserveReview.textContent = `Залишити ${fmt(review)} на підсумок (вправи — ${fmt(drills)})`;
        reserveReview.dataset.review = review;
        reserveReview.dataset.drills = drills;
        reserveReview.hidden = false;
      }
      openExercise.href = model.exerciseLink(cfg.game, cfg.focus);
      openExercise.hidden = !plan.drills;
      note.textContent = plan.config.mode === "matches"
        ? "Орієнтовна тривалість із очікуванням та перервами."
        : plan.config.mode === "drills" ? `Лише вправи, без матчів.${remaining}`
        : plan.matches
          ? `План вміщується у ${model.format(plan.config.budget)}.${remaining}`
          : `План без матчу: одне заняття з повним матчем потребує ${model.format(plan.firstMatchMinutes)}.${remaining}`;
      values.hidden = false;
      submit.disabled = false;
    } catch (problem) {
      note.textContent = problem.message;
      values.hidden = true;
      steps.hidden = true;
      exercise.hidden = true;
      submit.disabled = true;
    }
  }
  // The edit link carries the input, so refresh/back do not depend on browser storage.
  updateFocus();
  let currentGame = control("game").value;
  const restored = model.parse(window.location.search);
  const planKeys = ["mode", "game", "focus", ...Object.keys(model.ranges)];
  if (planKeys.some(key => Object.hasOwn(restored, key))) {
    try {
      const compact = !Object.hasOwn(restored, "mode") && Object.hasOwn(restored, "game");
      const firstFocus = Object.hasOwn(model.games, restored.game) ? Object.keys(model.games[restored.game].focuses)[0] : undefined;
      const config = model.normalize(compact ? model.preset(restored.game, restored.focus ?? firstFocus, restored.budget) : restored);
      control("game").value = config.game;
      updateFocus(config.focus);
      for (const [key, value] of Object.entries(config)) control(key).value = value;
      currentGame = config.game;
      settings.open = config.mode === "matches" || config.days > 1 ||
        ["warmup", "drills", "matchLength", "queue", "review", "breakMinutes"].some(key =>
          config[key] !== (key === "matchLength" ? model.games[config.game].matchLength : model.defaults[key]));
    } catch (_) {
      error.textContent = "Параметри посилання неповні або некоректні. Заповніть форму заново."; error.hidden = false;
    }
  }
  updateMode();
  addTime.addEventListener("click", () => {
    control("budget").value = addTime.dataset.budget;
    refresh();
    control("budget").focus();
  });
  reserveReview.addEventListener("click", () => {
    control("review").value = reserveReview.dataset.review;
    control("drills").value = reserveReview.dataset.drills;
    refresh();
    document.getElementById("training-live-heading-focus").focus();
  });
  for (const button of presets) button.addEventListener("click", () => {
    control("budget").value = button.dataset.budget;
    error.hidden = true;
    refresh();
  });
  form.addEventListener("invalid", event => {
    const settings = event.target.closest("details");
    if (settings) settings.open = true;
  }, true);
  form.addEventListener("change", event => {
    if (event.target.name === "game") {
      gameLengths.set(currentGame, control("matchLength").value);
      currentGame = control("game").value;
      updateFocus();
      control("matchLength").value = gameLengths.get(currentGame) ?? model.games[currentGame].matchLength;
    }
    if (event.target.name === "mode") updateMode();
    error.hidden = true;
    refresh();
  });
  form.addEventListener("input", event => {
    if (event.target.type !== "number") return;
    error.hidden = true;
    refresh();
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    try {
      const result = model.calculate(Object.fromEntries(new FormData(form)));
      window.location.assign(`results.html?${model.serialize(result.config)}#result-at-a-glance`);
    } catch (problem) {
      error.textContent = problem.message; error.hidden = false; error.focus();
    }
  });
  refresh();
  document.documentElement.dataset.appReady = "true";
  document.getElementById("app-load-status").hidden = true;
  window.dispatchEvent(new Event("kiberlviv:ready"));
})();
