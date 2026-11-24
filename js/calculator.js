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
  const errorAction = document.getElementById("training-error-action");
  const quick = document.getElementById("training-quick-summary");
  const threshold = document.getElementById("training-match-threshold");
  const changes = document.getElementById("training-live-changes");
  const warning = document.getElementById("training-live-warning");
  const bookingLink = document.getElementById("calculator-booking-link");
  const extra = document.getElementById("training-extra");
  const extraList = document.getElementById("training-extra-list");
  const prices = document.getElementById("calculator-prices");
  const priceGame = document.getElementById("calculator-prices-game");
  const lessonDuration = document.getElementById("calculator-lesson-duration");
  const priceCards = [...prices.querySelectorAll("[data-lesson-format]")];
  for (const card of priceCards) {
    const key = card.dataset.lessonFormat;
    const format = model.lessonFormats[key];
    card.querySelector("h3").textContent = format.title;
    for (const [packId, pack] of Object.entries(model.lessonPackages)) {
      const row = document.createElement("div");
      const label = document.createElement("dt");
      const value = document.createElement("dd");
      label.textContent = `${pack.title} · ${model.count(pack.count, "заняття", "заняття", "занять")}`;
      value.dataset.lessonPack = packId;
      row.append(label, value);
      card.querySelector("dl").append(row);
    }
  }
  const control = name => form.elements.namedItem(name);
  const budget = control("budget");
  const budgetOutput = document.getElementById("budget-value");
  const choices = ["mode", "game", "focus", "days", "matches", "budget"];
  const profileFields = ["rank", "targetRank", "ageGroup", "routine"];
  const profileKey = "kiberlviv-calculator-profile";
  const guide = document.getElementById("training-profile-guide");
  let manualBudget = false;
  let profile;
  const currentProfile = () => Object.fromEntries(profileFields.map(key => [key, control(key).value]));
  const settings = entries => ({
    ...model.trainingProfile(entries).config,
    ...Object.fromEntries(choices.filter(key => Object.hasOwn(entries, key)).map(key => [key, entries[key]])),
  });
  const calculate = () => {
    const entries = new Map();
    for (const [key, value] of new FormData(form)) {
      if (![...choices, ...profileFields].includes(key)) continue;
      if (entries.has(key)) throw new Error("Форма містить повторені поля. Оновіть сторінку й перевірте вибір.");
      entries.set(key, value);
    }
    return model.calculate(settings(Object.fromEntries(entries)));
  };
  let invalidInput;
  errorAction.addEventListener("click", () => {
    if (!invalidInput) return;
    invalidInput.focus();
  });
  function updateFocus(selected) {
    const game = control("game").value;
    const data = Object.hasOwn(model.games, game) ? model.games[game] : null;
    const select = control("focus");
    select.replaceChildren();
    for (const [key, [label]] of Object.entries(data?.focuses ?? {})) {
      const option = document.createElement("option");
      option.value = key; option.textContent = label; select.append(option);
    }
    if (data && Object.hasOwn(data.focuses, selected)) select.value = selected;
  }
  const rankList = () => Object.hasOwn(model.rankOptions, control("game").value) ? model.rankOptions[control("game").value] : [];
  function option(value, text) {
    const entry = document.createElement("option");
    entry.value = value;
    entry.textContent = text;
    return entry;
  }
  function updateTarget(selected) {
    const ranks = rankList();
    const current = ranks.findIndex(([id]) => id === control("rank").value);
    const available = ranks.slice(Math.max(0, current));
    const select = control("targetRank");
    select.replaceChildren(option("", "Без цілі за рангом"), ...available.map(([id, label]) =>
      option(id, id === control("rank").value ? label + " · закріпити рівень" : label)));
    select.value = available.some(([id]) => id === selected) ? selected : "";
    document.getElementById("training-target-help").textContent = selected && !select.value
      ? "Попередню ціль скинуто: вона нижча за поточний ранг."
      : "Ціль не нижче поточного рангу. Для оцінки різниці потрібно вказати обидва ранги.";
  }
  function updateRank(selected, target) {
    const game = control("game").value;
    const select = control("rank");
    const ranks = rankList();
    select.replaceChildren(option("", "Без рангу / не вказувати"),
      ...ranks.map(([id, label]) => option(id, label)));
    select.value = ranks.some(([id]) => id === selected) ? selected : "";
    updateTarget(target);
    document.getElementById("training-rank-help").textContent = game === "CS2"
      ? "Числовий CS Rating у Premier. Діапазони потрібні лише для оцінки."
      : "Оберіть поточний ранг без підрівня.";
  }
  function adjustBudget() {
    profile = model.trainingProfile({ game: control("game").value, focus: control("focus").value,
      mode: control("mode").value, ...currentProfile() });
    if (!manualBudget) budget.value = profile.suggestedMinutes;
    const max = model.maxMatches(profile.config);
    control("matches").max = max;
    document.getElementById("training-match-limit").textContent = `Із вибраними параметрами в одне заняття вміщається до ${max}.`;
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
    bookingLink.href = model.bookingLink(game);
    quick.textContent = threshold.textContent = "";
    changes.hidden = warning.hidden = true;
    invalidInput = null;
    errorAction.hidden = true;
    try {
      adjustBudget();
      budgetOutput.textContent = model.format(Number(budget.value));
      budget.setAttribute("aria-valuetext", budgetOutput.textContent);
      for (const [input, message] of messages) {
        const bad = !input.disabled && (!input.validity.valid || !/^\d+$/.test(input.value));
        if (bad) input.setAttribute("aria-invalid", "true");
        else input.removeAttribute("aria-invalid");
        message.hidden = !bad;
        message.textContent = bad ? `Введіть ціле число від ${input.min} до ${input.max}.` : "";
        if (bad && !invalidInput) invalidInput = input;
      }
      errorAction.hidden = !invalidInput;
      if (invalidInput) {
        const label = invalidInput.labels[0].textContent.trim().replace(/^\d+\.\s*/, "");
        throw new Error(`Перевірте поле «${label}»: потрібне ціле число від ${invalidInput.min} до ${invalidInput.max}.`);
      }
      const plan = calculate();
      try {
        window.sessionStorage.setItem(profileKey, JSON.stringify({
          signature: model.serialize(plan.config), fields: currentProfile()
        }));
      } catch { /* The calculator also works without browser storage. */ }
      const duration = model.suggestLessonDuration(plan.total);
      bookingLink.href = model.bookingFromCalculator(plan.config, undefined, duration);
      priceGame.textContent = plan.config.game;
      lessonDuration.textContent = duration > plan.total
        ? `Стандартне заняття з наставником триває ${model.format(duration)}. Ваш розрахунок коротший: ${model.format(plan.total)}.`
        : duration === model.standardLessonMinutes
          ? `Показуємо ціни на стандартне заняття — ${model.format(duration)}.`
          : `Показуємо ціни на ${model.format(duration)}: стандартні ${model.format(model.standardLessonMinutes)} і додаткові ${model.format(duration - model.standardLessonMinutes)}.`;
      for (const card of priceCards) {
        const key = card.dataset.lessonFormat;
        card.querySelector("[data-lesson-duration]").textContent = `+${model.formatPrice(model.lessonFormats[key].extensionPrice)} за кожні додаткові ${model.extensionStepMinutes} хв одного заняття${key === "group" ? " · за учасника" : ""}.`;
        for (const value of card.querySelectorAll("[data-lesson-pack]")) {
          const { base, extension, total } = model.lessonQuote(key, value.dataset.lessonPack, duration);
          value.textContent = model.formatPrice(total);
          if (extension) {
            const breakdown = document.createElement("small");
            breakdown.textContent = `${model.formatPrice(base)} + ${model.formatPrice(extension)}`;
            value.append(breakdown);
          }
        }
        card.querySelector("a").href = model.bookingFromCalculator(plan.config, key, duration);
      }
      prices.hidden = false;
      session.textContent = model.format(plan.total);
      week.textContent = model.format(plan.weeklyTotal);
      matches.textContent = String(plan.matches);
      weekItem.hidden = plan.config.days === 1;
      const fmt = model.format;
      extra.hidden = false;
      guide.textContent = [
        plan.config.mode !== "matches" ? `Орієнтир за вашими параметрами — ${fmt(profile.suggestedMinutes)}.` : "",
        ...profile.notes
      ].filter(Boolean).join(" ");
      extraList.replaceChildren(...model.steps(plan).map(([label, minutes]) => {
        const item = document.createElement("li");
        item.textContent = `${label} — ${fmt(minutes)}`;
        return item;
      }));
      const count = plan.matches ? model.count(plan.matches, "матч", "матчі", "матчів") : "без матчу";
      quick.textContent = `Оцінка часу: ${fmt(plan.total)} · ${count}.`;
      if (plan.config.mode === "budget") {
        threshold.textContent = `Одне заняття з матчем за цих налаштувань — від ${fmt(plan.firstMatchMinutes)}.`;
      }
      const cut = model.reductions(plan);
      changes.textContent = cut.length ? "Скорочено: " + cut.join("; ") + "." : "";
      changes.hidden = !cut.length;
      warning.textContent = model.volumeWarning(plan);
      warning.hidden = !warning.textContent;
      note.textContent = plan.config.mode === "matches"
        ? "Орієнтовна тривалість із очікуванням та перервами."
        : plan.config.mode === "drills" ? "Практика без матчів."
        : plan.matches
          ? `Заняття вміщується у ${model.format(plan.config.budget)}.`
          : `Заняття без матчу: для повного матчу з цими налаштуваннями потрібно ${model.format(plan.firstMatchMinutes)}.`;
      values.hidden = false;
      submit.disabled = false;
    } catch (problem) {
      note.textContent = problem.message;
      values.hidden = true;
      guide.textContent = "";
      extra.hidden = true;
      prices.hidden = true;
      submit.disabled = true;
    }
  }
  updateFocus();
  updateRank();
  try {
    const restored = model.parse(window.location.search);
    if (choices.some(key => Object.hasOwn(restored, key))) {
      const game = restored.game ?? control("game").value;
      const firstFocus = Object.hasOwn(model.games, game) ? Object.keys(model.games[game].focuses)[0] : undefined;
      const saved = Object.fromEntries(choices.filter(key => Object.hasOwn(restored, key)).map(key => [key, restored[key]]));
      let localProfile = {};
      if (restored.profiled === "1") {
        try {
          const previous = JSON.parse(window.sessionStorage.getItem(profileKey));
          if (previous?.signature === model.serialize(model.normalize(restored))) localProfile = previous.fields;
        } catch { /* The link remains usable without local profile details. */ }
      }
      const config = model.normalize(settings({ game, focus: firstFocus, ...saved, ...localProfile }));
      control("game").value = config.game;
      updateFocus(config.focus);
      updateRank(localProfile.rank, localProfile.targetRank);
      for (const key of ["ageGroup", "routine"]) {
        if ([...control(key).options].some(option => option.value === localProfile[key])) control(key).value = localProfile[key];
      }
      for (const key of choices) control(key).value = config[key];
      manualBudget = Object.hasOwn(restored, "budget") && config.mode !== "matches";
    }
  } catch (problem) {
    error.textContent = problem.message + " Відкрито початкові налаштування."; error.hidden = false;
  }
  updateMode();
  form.addEventListener("change", event => {
    if (event.target.name === "game") {
      updateFocus();
      updateRank();
    }
    if (event.target.name === "rank") updateTarget(control("targetRank").value);
    if (event.target.name === "mode") updateMode();
    error.hidden = true;
    refresh();
  });
  form.addEventListener("input", event => {
    if (!["number", "range"].includes(event.target.type)) return;
    if (event.target === budget) manualBudget = true;
    error.hidden = true;
    refresh();
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    try {
      const result = calculate();
      window.location.assign(model.bookingFromCalculator(result.config, undefined, model.suggestLessonDuration(result.total)));
    } catch (problem) {
      error.textContent = problem.message; error.hidden = false; error.focus();
    }
  });
  refresh();
  document.documentElement.dataset.appReady = "true";
  document.getElementById("app-load-status").hidden = true;
  window.dispatchEvent(new Event("kiberlviv:ready"));
})();
