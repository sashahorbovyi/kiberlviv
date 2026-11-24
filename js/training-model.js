/* Planning arithmetic only: these presets do not predict rank or health outcomes. */
(function (root, factory) {
  const model = factory();
  if (typeof module === "object" && module.exports) module.exports = model;
  else root.TrainingModel = model;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const games = {
    CS2: { matchLength: 40, focuses: {
      mechanics: ["Стрільба та рух", "Оберіть одну зброю: відпрацюйте зупинку перед пострілом і контроль короткої черги. У матчах стежте за тією самою дією."],
      utility: ["Використання гранат", "Оберіть одну карту й кілька потрібних гранат. Повторіть їх виконання та перевірте у матчах, чи допомогли вони виконати задум."],
      positioning: ["Позиції та розміни", "Відпрацюйте перевірку кутів на одній карті. У матчах звертайте увагу на дистанцію до напарника та можливість розміну."]
    } },
    "Dota 2": { matchLength: 45, focuses: {
      lane: ["Гра на лінії", "Оберіть героя й відпрацюйте добивання на тренувальній карті. У матчі зосередьтеся на одному рішенні на лінії, а після матчу перегляньте пропущені можливості."],
      farm: ["Фарм та переміщення", "Оберіть героя й повторіть маршрут фарму. У матчі перевірте, коли перехід до наступної ділянки карти був доречним для вашої ролі."],
      decisions: ["Рішення та цілі", "Розберіть один епізод перед командною дією: доступну інформацію, розташування союзників і мету. Перевірте цей підхід у наступних матчах."]
    } },
    Valorant: { matchLength: 40, focuses: {
      mechanics: ["Стрільба та рух", "На полігоні відпрацюйте точність після зупинки. У матчах оберіть цю дію головним фокусом, замість того, щоб змінювати всі звички одночасно."],
      utility: ["Здібності агента", "Оберіть одного агента й одну карту. Повторіть застосування здібності для конкретної ситуації, а в матчі перевірте її користь для команди."],
      review: ["Розбір командного раунду", "Перегляньте три епізоди. Запишіть, що команда знала перед дією, як ви домовилися діяти й що зміните в наступному раунді."],
      positioning: ["Позиції та командна гра", "Оберіть одну ділянку карти й продумайте перевірку кутів. У матчах перевіряйте, чи дозволяє позиція допомогти союзнику та відійти."]
    } }
  };
  const defaults = { mode: "matches", game: "CS2", focus: "mechanics", days: 4,
    matches: 2, budget: 145, warmup: 10, drills: 20, matchLength: 40,
    queue: 5, review: 15, breakMinutes: 10 };
  const ranges = { days: [1, 7], matches: [1, 50], budget: [1, 1440],
    warmup: [0, 180], drills: [0, 360], matchLength: [5, 180],
    queue: [0, 120], review: [0, 180], breakMinutes: [0, 120] };
  function preset(game = defaults.game, focus = defaults.focus, budget = 90) {
    return { ...defaults, mode: "budget", days: 1, budget, game, focus, matchLength: games[game]?.matchLength };
  }
  function normalize(raw) {
    const config = {};
    if (!raw || !["matches", "budget", "drills"].includes(raw.mode)) throw new Error("Оберіть режим розрахунку.");
    if (!Object.hasOwn(games, raw.game)) throw new Error("Оберіть гру зі списку.");
    if (!Object.hasOwn(games[raw.game].focuses, raw.focus)) throw new Error("Оберіть фокус тренування для цієї гри.");
    config.mode = raw.mode; config.game = raw.game; config.focus = raw.focus;
    for (const [key, [min, max]] of Object.entries(ranges)) {
      // Ignore inactive controls; neither an old value nor a disabled field affects the plan.
      if ((key === "matches" && raw.mode !== "matches") || (key === "budget" && raw.mode === "matches")) {
        config[key] = defaults[key]; continue;
      }
      const value = raw[key];
      if ((typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value))) ||
          !Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max) {
        throw new Error("Перевірте числові поля: потрібні цілі значення в зазначених межах.");
      }
      config[key] = Number(value);
    }
    return config;
  }
  function calculate(raw) {
    const config = normalize(raw);
    let { warmup, drills, review } = config;
    let matches = config.matches;
    const base = warmup + drills + review;
    if (config.mode !== "matches") {
      matches = config.mode === "drills" ? 0 : Math.min(ranges.matches[1], Math.max(0,
        Math.floor((config.budget - base + config.breakMinutes) /
        (config.matchLength + config.queue + config.breakMinutes))));
      if (!matches && config.budget < base) {
        // Short skills session: retain the order of preparation, drills and review.
        warmup = Math.min(warmup, config.budget);
        drills = Math.min(drills, config.budget - warmup);
        review = Math.min(review, config.budget - warmup - drills);
      }
    }
    const matchTime = matches * config.matchLength;
    const queueTime = matches * config.queue;
    const breaks = Math.max(0, matches - 1) * config.breakMinutes;
    const active = warmup + drills + matchTime + review;
    const total = active + queueTime + breaks;
    if (active === 0) throw new Error("За цих налаштувань не вміщується жоден тренувальний блок. Додай час на вправи або збільште доступний час.");
    if (total > 1440) throw new Error("Одне заняття перевищує 24 години. Зменшіть кількість матчів або тривалість блоків.");
    const remaining = config.mode !== "matches" ? config.budget - total : 0;
    return { config, warmup, drills, review, matches, matchTime, queueTime, breaks,
      firstMatchMinutes: base + config.matchLength + config.queue,
      active, total, remaining, weeklyTotal: total * config.days,
      weeklyActive: active * config.days, weeklyMatches: matches * config.days,
      shortened: warmup !== config.warmup || drills !== config.drills || review !== config.review };
  }
  function steps(plan) {
    const output = [];
    const append = (label, minutes) => { if (minutes > 0) output.push([label, minutes]); };
    append("Розминка", plan.warmup);
    append("Вправи", plan.drills);
    for (let i = 1; i <= plan.matches; i++) {
      append("Пошук матчу", plan.config.queue);
      append(plan.matches === 1 ? "Матч" : `Матч ${i}`, plan.config.matchLength);
      if (i < plan.matches) append("Перерва", plan.config.breakMinutes);
    }
    append("Розбір і висновки", plan.review);
    return output;
  }
  function reductions(plan) {
    return [["Розминка","warmup"],["Вправи","drills"],["Розбір","review"]]
      .filter(([, key]) => plan[key] < plan.config[key])
      .map(([label, key]) => `${label}: ${format(plan.config[key])} → ${format(plan[key])}`);
  }
  function volumeWarning(plan) {
    return plan.total > 240 || plan.weeklyTotal > 1200
      ? `Перевірте обсяг плану: ${format(plan.total)} за заняття та ${format(plan.weeklyTotal)} за тиждень.` : "";
  }
  function exerciseLink(game, focus) {
    const section = programLink(game);
    return Object.hasOwn(games, game) && Object.hasOwn(games[game].focuses, focus) ? `${section}-${focus}` : section;
  }
  function programLink(game) {
    const sections = { CS2: "cs2", "Dota 2": "dota-2", Valorant: "valorant" };
    return Object.hasOwn(sections, game) ? `training.html#${sections[game]}` : "training.html";
  }
  function bookingLink(game) {
    const params = Object.hasOwn(games, game) ? "?" + new URLSearchParams({ game }) : "";
    return `register.html${params}#booking-options`;
  }
  function serialize(config) {
    const params = new URLSearchParams();
    for (const key of ["mode", "game", "focus", ...Object.keys(ranges)]) params.set(key, String(config[key]));
    return params.toString();
  }
  function parse(search) { return Object.fromEntries(new URLSearchParams(search)); }
  function format(minutes) {
    const hours = Math.floor(minutes / 60), rest = minutes % 60;
    return hours ? `${hours} год${rest ? ` ${rest} хв` : ""}` : `${rest} хв`;
  }
  function count(value, one, few, many) {
    const last = value % 10, lastTwo = value % 100;
    const word = lastTwo >= 11 && lastTwo <= 14 ? many
      : last === 1 ? one : last >= 2 && last <= 4 ? few : many;
    return `${value} ${word}`;
  }
  return { games, defaults, ranges, preset, normalize, calculate, steps, reductions, volumeWarning, exerciseLink, programLink, bookingLink, serialize, parse, format, count };
});
