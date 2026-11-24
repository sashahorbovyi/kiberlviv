(() => {
  const model = window.TrainingModel;
  const form = document.getElementById('training-quick');
  if (!model || !form) return;
  const input = document.getElementById('training-quick-budget');
  const result = document.getElementById('training-quick-result');
  const button = form.querySelector('button');
  [input.min, input.max] = model.ranges.budget;
  input.value = model.preset().budget;
  function refresh() {
    try {
      const plan = model.calculate(model.preset(undefined, undefined, input.value));
      const count = model.count(plan.matches, 'матч', 'матчі', 'матчів');
      result.textContent = `${model.format(plan.total)} на заняття · ${count}${plan.extraMinutes ? " · додаткові активності: " + model.format(plan.extraMinutes) : ""}.`;
      input.removeAttribute('aria-invalid');
      button.disabled = false;
      return plan;
    } catch {
      result.textContent = `Введіть ціле число від ${input.min} до ${input.max} хв.`;
      input.setAttribute('aria-invalid', 'true');
      button.disabled = true;
      return null;
    }
  }
  form.addEventListener('input', refresh);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const plan = refresh();
    if (plan) window.location.assign(`calculator.html?${model.serialize(plan.config)}`);
  });
  refresh();
  form.hidden = false;
})();
