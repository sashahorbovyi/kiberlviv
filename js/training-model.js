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
  const subranks = (rank, level, tiers) => tiers.map((tier, i) =>
    [rank.toLowerCase() + (i ? "-" + (i + 1) : ""), rank + " " + tier, level]);
  const rankOptions = {
    CS2: [["entry", "CS Rating до 5 000", "foundation"], ["low", "CS Rating 5 000–9 999", "foundation"],
      ["mid", "CS Rating 10 000–14 999", "balanced"], ["upper-mid", "CS Rating 15 000–19 999", "balanced"],
      ["high", "CS Rating 20 000–24 999", "analysis"], ["elite", "CS Rating 25 000–29 999", "analysis"], ["top", "CS Rating від 30 000", "analysis"]],
    "Dota 2": ["Herald", "Guardian", "Crusader", "Archon", "Legend", "Ancient", "Divine", "Immortal"]
      .flatMap((rank, i) => rank === "Immortal" ? [["immortal", rank, "analysis"]]
        : subranks(rank, i < 3 ? "foundation" : i < 6 ? "balanced" : "analysis", ["I", "II", "III", "IV", "V"])),
    Valorant: ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"]
      .flatMap((rank, i) => rank === "Radiant" ? [["radiant", rank, "analysis"]]
        : subranks(rank, i < 3 ? "foundation" : i < 6 ? "balanced" : "analysis", ["I", "II", "III"]))
  };
  const gamePractice = {
    CS2: { warmup: 10, drills: 20, review: 15, warmupLabel: "Рух і зупинка перед пострілом", reviewLabel: "Розбір раундів і рішень на карті", drillLabels: {
      mechanics: "Точність першого пострілу й контроль руху", utility: "Гранати для однієї карти й сценарію", positioning: "Кути, позиції та розміни в парі"
    } },
    "Dota 2": { warmup: 8, drills: 25, review: 20, warmupLabel: "Добивання крипів і робота з камерою", reviewLabel: "Розбір рішень на лінії та переміщень", drillLabels: {
      lane: "Добивання, хвилі крипів і гра на лінії", farm: "Маршрут фарму та переходи за мінікартою", decisions: "Вибір цілі та моменту командної дії"
    } },
    Valorant: { warmup: 10, drills: 22, review: 18, warmupLabel: "Точність після зупинки на полігоні", reviewLabel: "Розбір раундів, позицій та здібностей", drillLabels: {
      mechanics: "Стрільба після зупинки й контроль прицілу", utility: "Здібності агента в конкретному сценарії",
      review: "Розбір раунду й повторення рішення", positioning: "Позиції, вихід на точку й комунікація"
    } }
  };
  function trainingProfile({ game = defaults.game, focus, rank = "", targetRank = "", ageGroup = "", routine = "", mode = "budget" } = {}) {
    const practice = gamePractice[game];
    if (!Object.hasOwn(gamePractice, game)) throw new Error("Оберіть гру зі списку.");
    const skill = focus ?? Object.keys(practice.drillLabels)[0];
    if (!Object.hasOwn(practice.drillLabels, skill)) throw new Error("Оберіть навичку для вибраної гри.");
    if (!["budget", "matches"].includes(mode)) throw new Error("Оберіть режим розрахунку.");
    const ageOptions = ["", "under13", "13to15", "16to17", "18to24", "25to34", "35to44", "45plus", "minor", "adult"];
    if (!ageOptions.includes(ageGroup)) throw new Error("Оберіть вікову групу зі списку.");
    if (!["", "starting", "occasional", "regular"].includes(routine)) throw new Error("Оберіть регулярність практики зі списку.");
    const ranks = rankOptions[game];
    const current = ranks.findIndex(([id]) => id === rank);
    const target = ranks.findIndex(([id]) => id === targetRank);
    if ((rank !== "" && current < 0) || (targetRank !== "" && target < 0)) throw new Error("Оберіть ранги для вибраної гри.");
    if (current >= 0 && target >= 0 && target < current) throw new Error("Бажаний ранг не може бути нижчим за поточний.");
    const rankGap = current >= 0 && target >= 0 ? target - current : 0;
    const level = ranks[current]?.[2] ?? "balanced";
    const junior = ["under13", "13to15", "16to17", "minor"].includes(ageGroup);
    const shorterDrills = ageGroup === "under13" ? 5 : ageGroup === "16to17" ? 2 : junior ? 3 : 0;
    const starting = routine === "starting";
    const regular = routine === "regular";
    const warmup = practice.warmup + (level === "foundation" ? 2 : level === "analysis" ? -3 : 0);
    const drills = practice.drills + (level === "foundation" ? 6 : level === "analysis" ? -4 : 0)
      + (starting ? -5 : regular ? 5 : 0) - shorterDrills;
    const review = practice.review + (level === "analysis" ? 10 : 0) - (starting ? 3 : 0) + Math.min(2, rankGap) * 5;
    const breakMinutes = junior ? 15 : defaults.breakMinutes;
    const matchLength = games[game].matchLength;
    const firstMatch = warmup + drills + review + matchLength + defaults.queue;
    const suggested = firstMatch + (junior ? 5 : regular ? 10 : 0);
    const suggestedMinutes = Math.min(sessionLimit, Math.ceil(suggested / 5) * 5);
    return {
      config: { ...preset(game, skill, suggestedMinutes), mode, warmup, drills, review, matchLength, breakMinutes, profiled: true },
      minimumMinutes: firstMatch,
      suggestedMinutes,
      notes: [
        level === "foundation" ? "Більше уваги до базових повторів." : level === "analysis" ? "Більше часу на розбір рішень." : "",
        junior ? "Для вікової групи до 18 років орієнтир коротший. Якщо є вільний час, спочатку закладаємо паузу." : "",
        starting ? "Для тих, хто починає тренуватися, блоки вправ і розбору коротші; один матч залишається." : regular ? "Регулярна практика додає час на цільові вправи." : "",
        rankGap > 0 ? `Для цілі додано до ${Math.min(2, rankGap) * 5} хв на розбір рішень.` : ""
      ].filter(Boolean)
    };
  }
  const sessionLimit = 240;
  const ranges = { days: [1, 7], matches: [1, sessionLimit / 5], budget: [1, sessionLimit],
    warmup: [0, sessionLimit], drills: [0, sessionLimit], matchLength: [5, sessionLimit],
    queue: [0, 120], review: [0, 180], breakMinutes: [0, 120] };
  function maxMatches(config) {
    const available = sessionLimit - config.warmup - config.drills - config.review + config.breakMinutes;
    return Math.max(0, Math.min(ranges.matches[1],
      Math.floor(available / (config.matchLength + config.queue + config.breakMinutes))));
  }
  const lessonFormats = {
    individual: { title: 'Індивідуально', prices: [690, 2390, 4390], extensionPrice: 85 },
    group: { title: 'Мала група', prices: [310, 1110, 2070], extensionPrice: 40 }
  };
  const lessonPackages = {
    intro: { title: 'Пробне', count: 1, index: 0 },
    base: { title: 'Основа', count: 4, index: 1 },
    progress: { title: 'Прогрес', count: 8, index: 2 }
  };
  const standardLessonMinutes = 120;
  const extensionStepMinutes = 15;
  const lessonDurations = Object.freeze(Array.from({ length: sessionLimit }, (_, i) => i + 1));
  function suggestLessonDuration(minutes) {
    return lessonDurations.findLast(duration => duration <= minutes) ?? lessonDurations[0];
  }
  function lessonQuote(format, pack, minutes, initialMinutes = Math.min(minutes, standardLessonMinutes)) {
    if (!Object.hasOwn(lessonFormats, format) || !Object.hasOwn(lessonPackages, pack) ||
        !lessonDurations.includes(minutes) || !lessonDurations.includes(initialMinutes) || initialMinutes > minutes) return null;
    const rate = lessonFormats[format];
    const selectedPackage = lessonPackages[pack];
    const totalAt = time => Math.round(time <= standardLessonMinutes
      ? rate.prices[selectedPackage.index] * time / standardLessonMinutes
      : rate.prices[selectedPackage.index] + (time - standardLessonMinutes) * rate.extensionPrice * selectedPackage.count / extensionStepMinutes);
    const base = totalAt(initialMinutes);
    const total = totalAt(minutes);
    return { base, extension: total - base, extraMinutes: minutes - initialMinutes, total };
  }
  const lessonPrice = (format, pack, minutes) => lessonQuote(format, pack, minutes)?.total ?? null;
  const priceFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });
  const formatPrice = amount => priceFormat.format(amount) + ' грн';
  function preset(game = defaults.game, focus = defaults.focus, budget = 90) {
    return { ...defaults, mode: "budget", days: 1, budget, game, focus, matchLength: games[game]?.matchLength };
  }
  function normalize(raw) {
    const config = {};
    if (!raw || !["matches", "budget", "drills"].includes(raw.mode)) throw new Error("Оберіть режим розрахунку.");
    if (!Object.hasOwn(games, raw.game)) throw new Error("Оберіть гру зі списку.");
    if (!Object.hasOwn(games[raw.game].focuses, raw.focus)) throw new Error("Оберіть фокус тренування для цієї гри.");
    config.mode = raw.mode; config.game = raw.game; config.focus = raw.focus;
    if (raw.profiled !== undefined && raw.profiled !== true && raw.profiled !== "1") throw new Error("Параметри профілю некоректні.");
    if (raw.profiled !== undefined) config.profiled = true;
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
    const firstMatchMinutes = base + config.matchLength + config.queue;
    if (config.profiled && (config.mode === "drills" || (config.mode === "budget" && config.budget < firstMatchMinutes))) {
      throw new Error(`Для заняття з повним матчем потрібно щонайменше ${firstMatchMinutes} хв.`);
    }
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
    const coreActive = warmup + drills + matchTime + review;
    const coreTotal = coreActive + queueTime + breaks;
    if (coreActive === 0) throw new Error("За цих налаштувань не вміщується жоден тренувальний блок. Додайте час на вправи або збільште доступний час.");
    if (coreTotal > sessionLimit) throw new Error(`Ліміт одного заняття — ${sessionLimit} хв. Зменште кількість матчів або тривалість блоків.`);
    const extraMinutes = config.mode === "matches" ? 0 : config.budget - coreTotal;
    const extra = [];
    let unallocated = extraMinutes;
    let extraBreaks = 0;
    const practice = config.profiled ? gamePractice[config.game] : null;
    const shortBlocks = config.profiled && config.breakMinutes > defaults.breakMinutes;
    const earlyPause = shortBlocks && unallocated >= 5 ? Math.min(8, unallocated) : 0;
    if (earlyPause) {
      unallocated -= earlyPause;
      extraBreaks += earlyPause;
    }
    const cycle = [
      [practice ? practice.drillLabels[config.focus] + " (додаткові повтори)" : "Додаткові повтори обраної навички", shortBlocks ? 10 : 15, false],
      [practice ? practice.reviewLabel + " (додатково)" : "Розбір епізоду та нотатки", shortBlocks ? 8 : 10, false],
      ["Пауза без екрана", shortBlocks ? 8 : 5, true]
    ];
    for (let i = 0; unallocated > 0; i++) {
      const [title, duration, isBreak] = cycle[i % cycle.length];
      const minutes = Math.min(unallocated, duration);
      extra.push([title, minutes]);
      if (isBreak) extraBreaks += minutes;
      unallocated -= minutes;
    }
    const active = coreActive + extraMinutes - extraBreaks;
    const total = coreTotal + extraMinutes;
    return { config, warmup, drills, review, matches, matchTime, queueTime, breaks,
      firstMatchMinutes,
      active, total, coreTotal, extra, earlyPause, extraMinutes, extraBreaks, weeklyTotal: total * config.days,
      weeklyActive: active * config.days, weeklyMatches: matches * config.days,
      shortened: warmup !== config.warmup || drills !== config.drills || review !== config.review };
  }
  function steps(plan) {
    const output = [];
    const append = (label, minutes) => { if (minutes > 0) output.push([label, minutes]); };
    const practice = plan.config.profiled ? gamePractice[plan.config.game] : null;
    append(practice?.warmupLabel ?? "Розминка", plan.warmup);
    append(practice?.drillLabels[plan.config.focus] ?? "Вправи", plan.drills);
    append("Пауза без екрана", plan.earlyPause);
    for (let i = 1; i <= plan.matches; i++) {
      append("Пошук матчу", plan.config.queue);
      append(plan.matches === 1 ? "Матч" : `Матч ${i}`, plan.config.matchLength);
      if (i < plan.matches) append("Перерва", plan.config.breakMinutes);
    }
    append(practice?.reviewLabel ?? "Розбір і висновки", plan.review);
    output.push(...plan.extra);
    return output;
  }
  function reductions(plan) {
    return [["Розминка","warmup"],["Вправи","drills"],["Розбір","review"]]
      .filter(([, key]) => plan[key] < plan.config[key])
      .map(([label, key]) => `${label}: ${format(plan.config[key])} → ${format(plan[key])}`);
  }
  function volumeWarning(plan) {
    return plan.weeklyTotal > 1200
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
    if (config.profiled) params.set("profiled", "1");
    return params.toString();
  }
  function bookingFromCalculator(config, format, duration, pack) {
    const params = new URLSearchParams(serialize(config));
    params.set("from", "calculator");
    if (Object.hasOwn(lessonFormats, format)) params.set("format", format);
    if (lessonDurations.includes(duration)) params.set("duration", duration);
    if (Object.hasOwn(lessonPackages, pack)) params.set("package", pack);
    return `register.html?${params}#booking-options`;
  }
  const uniqueFields = new Set(["mode", "game", "focus", ...Object.keys(ranges), "profiled", "example",
    "from", "format", "duration", "package", "applicant"]);
  function parse(search) {
    const entries = new Map();
    for (const [key, value] of new URLSearchParams(search)) {
      if (!uniqueFields.has(key)) continue;
      if (entries.has(key)) throw new Error("Посилання містить повторені параметри. Перевірте свій вибір.");
      entries.set(key, value);
    }
    return Object.fromEntries(entries);
  }
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
  return { games, defaults, ranges, rankOptions, trainingProfile, maxMatches, sessionLimit, lessonFormats, lessonPackages, lessonDurations, standardLessonMinutes, extensionStepMinutes, suggestLessonDuration, lessonQuote, lessonPrice, formatPrice, preset, normalize, calculate, steps, reductions, volumeWarning, exerciseLink, programLink, bookingLink, bookingFromCalculator, serialize, parse, format, count };
});
