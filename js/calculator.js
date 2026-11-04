(function () {
  "use strict";
  const model = window.TrainingModel;
  const form = document.getElementById("calculator-form");
  if (!form || !model) return;
  const error = document.getElementById("calculator-error");
  const control = name => form.elements.namedItem(name);
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
    const budget = control("mode").value === "budget";
    for (const [id, visible, name] of [["matches-field", !budget, "matches"], ["budget-field", budget, "budget"]]) {
      document.getElementById(id).hidden = !visible;
      control(name).disabled = !visible;
    }
    document.getElementById("calculator-submit").textContent = budget ? "Скласти заняття" : "Розрахувати час";
  }
  // The edit link carries the input, so refresh/back do not depend on browser storage.
  updateFocus();
  const restored = model.parse(window.location.search);
  if (Object.keys(restored).length) {
    try {
      const config = model.normalize(restored);
      control("game").value = config.game;
      updateFocus(config.focus);
      for (const [key, value] of Object.entries(config)) control(key).value = value;
    } catch (_) {
      error.textContent = "Параметри посилання неповні або некоректні. Заповни форму заново."; error.hidden = false;
    }
  }
  updateMode();
  form.addEventListener("invalid", event => {
    const settings = event.target.closest("details");
    if (settings) settings.open = true;
  }, true);
  form.addEventListener("change", event => {
    if (event.target.name === "game") {
      updateFocus(); control("matchLength").value = model.games[control("game").value].matchLength;
    }
    if (event.target.name === "mode") updateMode();
    error.hidden = true;
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    try {
      const result = model.calculate(Object.fromEntries(new FormData(form)));
      window.location.assign(`results.html?${model.serialize(result.config)}`);
    } catch (problem) {
      error.textContent = problem.message; error.hidden = false; error.focus();
    }
  });
  document.getElementById("calculator-submit").disabled = false;
  document.documentElement.dataset.appReady = "true";
  document.getElementById("app-load-status").hidden = true;
  window.dispatchEvent(new Event("kiberlviv:ready"));
})();
