/* Planning arithmetic only: these presets do not predict rank or health outcomes. */
(function (root, factory) {
  const model = factory();
  if (typeof module === "object" && module.exports) module.exports = model;
  else root.TrainingModel = model;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const games = {
    CS2: { matchLength: 40, focuses: {
      mechanics: ["Стрільба та рух", "Обери одну зброю: відпрацюй зупинку перед пострілом і контроль короткої черги. У матчах стеж за тією самою дією."],
      utility: ["Використання гранат", "Обери одну карту й кілька потрібних гранат. Повтори їх виконання та перевір у матчах, чи допомогли вони виконати задум."],
      positioning: ["Позиції та розміни", "Відпрацюй перевірку кутів на одній карті. У матчах звертай увагу на дистанцію до напарника та можливість розміну."]
    } },
    "Dota 2": { matchLength: 45, focuses: {
      lane: ["Гра на лінії", "Обери героя й відпрацюй добивання на тренувальній карті. У матчі зосередься на одному рішенні на лінії, а після переглянь пропущені можливості."],
      farm: ["Фарм та переміщення", "Обери героя й повтори маршрут фарму. У матчі перевір, коли перехід до наступної ділянки карти був доречним для твоєї ролі."],
      decisions: ["Рішення та цілі", "Розбери один епізод перед командною дією: доступну інформацію, розташування союзників і мету. Перевір цей підхід у наступних матчах."]
    } },
    Valorant: { matchLength: 40, focuses: {
      mechanics: ["Стрільба та рух", "На полігоні відпрацюй точність після зупинки. У матчах обери цю дію головним фокусом, замість одночасної зміни всіх звичок."],
      utility: ["Здібності агента", "Обери одного агента й одну карту. Повтори застосування здібності для конкретної ситуації, а в матчі перевір її користь для команди."],
      positioning: ["Позиції та командна гра", "Обери одну ділянку карти й продумай перевірку кутів. У матчах перевіряй, чи дозволяє позиція допомогти союзнику та відійти."]
    } }
  };
  const defaults = { mode: "matches", game: "CS2", focus: "mechanics", days: 4,
    matches: 2, budget: 145, warmup: 10, drills: 20, matchLength: 40,
    queue: 5, review: 15, breakMinutes: 10 };
  const ranges = { days: [1, 7], matches: [1, 50], budget: [1, 1440],
    warmup: [0, 180], drills: [0, 360], matchLength: [5, 180],
    queue: [0, 120], review: [0, 180], breakMinutes: [0, 120] };
  function normalize(raw) {
    const config = {};
    if (!raw || !["matches", "budget"].includes(raw.mode)) throw new Error("Обери режим розрахунку.");
    if (!Object.hasOwn(games, raw.game)) throw new Error("Обери гру зі списку.");
    if (!Object.hasOwn(games[raw.game].focuses, raw.focus)) throw new Error("Обери фокус тренування для цієї гри.");
    config.mode = raw.mode; config.game = raw.game; config.focus = raw.focus;
    for (const [key, [min, max]] of Object.entries(ranges)) {
      // Ignore inactive controls; neither an old value nor a disabled field affects the plan.
      if ((key === "matches" && raw.mode === "budget") || (key === "budget" && raw.mode === "matches")) {
        config[key] = defaults[key]; continue;
      }
      const value = raw[key];
      if (value === "" || value == null || !Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max) {
        throw new Error("Перевір числові поля: потрібні цілі значення в зазначених межах.");
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
    if (config.mode === "budget") {
      matches = Math.max(0, Math.floor((config.budget - base + config.breakMinutes) /
        (config.matchLength + config.queue + config.breakMinutes)));
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
    if (active === 0) throw new Error("За цих налаштувань не вміщується жоден тренувальний блок. Додай час на вправи або збільш доступний час.");
    if (total > 1440) throw new Error("Одне заняття перевищує 24 години. Зменш кількість матчів або тривалість блоків.");
    const remaining = config.mode === "budget" ? config.budget - total : 0;
    return { config, warmup, drills, review, matches, matchTime, queueTime, breaks,
      active, total, remaining, weeklyTotal: total * config.days,
      weeklyActive: active * config.days, weeklyMatches: matches * config.days,
      shortened: warmup !== config.warmup || drills !== config.drills || review !== config.review };
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
  return { games, defaults, ranges, normalize, calculate, serialize, parse, format, count };
});
