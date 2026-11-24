const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../js/training-model.js");
const plan = changes => model.calculate({ ...model.defaults, ...changes });

test("rank goals change review time only for a valid higher target in the selected game", () => {
  const current = { game: "Valorant", rank: "gold" };
  const base = model.trainingProfile(current);
  const goal = model.trainingProfile({ ...current, targetRank: "diamond" });
  assert.equal(goal.config.review, base.config.review + 10);
  assert.equal(goal.suggestedMinutes, base.suggestedMinutes + 10);
  assert.equal(model.trainingProfile({ ...current, targetRank: "gold" }).config.review, base.config.review);
  assert.throws(() => model.trainingProfile({ ...current, targetRank: "iron" }), /нижчим/);
  assert.throws(() => model.trainingProfile({ ...current, targetRank: "herald" }), /ранги/);
  assert.throws(() => model.trainingProfile({ ...current, ageGroup: "999" }), /вікову/);
  assert.throws(() => model.trainingProfile({ ...current, routine: "bad" }), /регулярність/);
  assert.equal(model.maxMatches(goal.config), 2);
});

test("known duplicate query parameters are rejected even if the values are identical", () => {
  assert.throws(() => model.parse("?days=2&days=2"), /повторені/);
  assert.throws(() => model.parse("?game=CS2&%67ame=Valorant"), /повторені/);
  assert.throws(() => model.parse("?format=group&format=individual"), /повторені/);
  assert.deepEqual(model.parse("?game=CS2&utm=1&utm=2"), { game: "CS2" });
});

test("profiles adapt blocks to the game, rank, age group and practice routine without exceeding the budget", () => {
  const base = model.trainingProfile({ game: "Dota 2", focus: "farm" });
  const junior = model.trainingProfile({ game: "Dota 2", focus: "farm", ageGroup: "minor", routine: "starting" });
  const advanced = model.trainingProfile({ game: "Dota 2", focus: "farm", rank: "immortal" });
  const beginner = model.trainingProfile({ game: "Dota 2", focus: "farm", rank: "herald" });
  const valorant = model.trainingProfile({ game: "Valorant", focus: "utility" });
  assert.ok(junior.suggestedMinutes < base.suggestedMinutes);
  assert.ok(junior.config.drills < base.config.drills);
  assert.ok(advanced.config.review > beginner.config.review);
  assert.ok(beginner.config.drills > advanced.config.drills);
  assert.notEqual(base.config.drills, valorant.config.drills);
  const r = model.calculate(junior.config);
  const blocks = model.steps(r);
  assert.equal(blocks.reduce((sum, [, time]) => sum + time, 0), junior.suggestedMinutes);
  assert.ok(blocks.some(([label]) => label === "Маршрут фарму та переходи за мінікартою"));
  assert.ok(blocks.some(([label]) => label === "Пауза без екрана"));
  assert.deepEqual(model.calculate(model.parse(model.serialize(r.config))), r);
  const link = new URL(model.bookingFromCalculator(r.config), "https://example.test");
  assert.ok(["ageGroup", "rank", "routine"].every(key => !link.searchParams.has(key)));
});

test("lesson extensions add one fifteen-minute fee per session without changing the two-hour base price", () => {
  assert.equal(model.lessonPrice("individual", "intro", 120), 1380);
  assert.equal(model.lessonPrice("individual", "intro", 150), 1720);
  assert.equal(model.lessonPrice("group", "intro", 120), 620);
  assert.deepEqual(model.lessonQuote("group", "base", 135), {base: 2220, extension: 320, extraMinutes: 15, total: 2540});
  assert.equal(model.lessonPrice("group", "base", 20), null);
  assert.equal(model.suggestLessonDuration(20), 120);
  assert.equal(model.suggestLessonDuration(148), 135);
  assert.equal(model.suggestLessonDuration(180), 180);
});

test("two full matches include queues and one inter-match break", () => {
  const r = plan({});
  assert.equal(r.total, 145);
  assert.equal(r.active, 125);
  assert.equal(r.breaks, 10);
  assert.equal(r.weeklyTotal, 580);
  assert.equal(r.weeklyActive, 500);
  assert.equal(r.weeklyMatches, 8);
});
test("one match has no inter-match break", () => {
  const r = plan({ matches: 1 });
  assert.equal(r.total, 90);
  assert.equal(r.breaks, 0);
});
test("budget fits whole matches at exact boundary", () => {
  assert.equal(plan({ mode: "budget", budget: 145 }).matches, 2);
  const below = plan({ mode: "budget", budget: 144 });
  assert.equal(below.matches, 1);
  assert.equal(below.extraMinutes, 54);
});
test("insufficient match budget creates a skills session, not a partial match", () => {
  const r = plan({ mode: "budget", budget: 89 });
  assert.equal(r.matches, 0);
  assert.equal(r.coreTotal, 45);
  assert.equal(r.total, 89);
  assert.equal(r.queueTime, 0);
  assert.equal(r.breaks, 0);
  assert.equal(r.extraMinutes, 44);
  assert.deepEqual(r.extra.map(block => block[1]), [15, 10, 5, 14]);
});
test("very short budget trims preparation in the stated order", () => {
  const r = plan({ mode: "budget", budget: 25 });
  assert.deepEqual([r.warmup, r.drills, r.review], [10, 15, 0]);
  assert.equal(r.total, 25);
  assert.equal(r.shortened, true);
});
test("invalid, fractional, missing, negative and non-finite inputs fail", () => {
  for (const changes of [{ days: 0 }, { days: 8 }, { matches: 1.5 },
    { queue: -1 }, { review: "" }, { drills: NaN }, { matchLength: Infinity },
    { game: "__proto__" }, { focus: "constructor" }, { mode: "other" }]) {
    assert.throws(() => plan(changes), JSON.stringify(changes));
  }
});
test("a session is limited to 180 minutes in all modes", () => {
  for (const mode of ["budget", "drills"]) assert.throws(() => plan({ mode, budget: 181 }), /межах/);
  assert.throws(() => plan({ matches: 3 }), /180 хв/);
  assert.equal(plan({ matches: 3, matchLength: 35, queue: 5, breakMinutes: 5, review: 20 }).total, 180);
});
test("a budget with no possible training blocks produces a useful error", () => {
  assert.throws(() => plan({ mode: "budget", budget: 1, warmup: 0, drills: 0, review: 0 }), /блок/);
});
test("inactive fields cannot change or invalidate a plan", () => {
  assert.equal(plan({ budget: "" }).total, 145);
  assert.equal(plan({ mode: "budget", budget: 145, matches: "bad" }).total, 145);
});
test("time values in restored links reject whitespace, booleans and non-decimal notation", () => {
  for (const queue of [" ", false, [], "0x10", "1e1", "1.0"]) {
    assert.throws(() => plan({ queue }));
  }
  assert.equal(plan({ queue: "0" }).queueTime, 0);
});
test("game and focus survive the result/edit URL round trip", () => {
  const expected = plan({ game: "Dota 2", focus: "lane", matchLength: 45 });
  const restored = model.calculate(model.parse(model.serialize(expected.config)));
  assert.deepEqual(restored, expected);
});
test("across budgets, allocated time fits and another full match never fits", () => {
  for (const game of Object.keys(model.games)) {
    const focus = Object.keys(model.games[game].focuses)[0];
    for (let budget = 1; budget <= model.sessionLimit; budget++) {
      const r = plan({ mode: "budget", game, focus, budget, matchLength: model.games[game].matchLength });
      assert.equal(r.total, budget);
      assert.equal(r.coreTotal + r.extraMinutes, budget);
      assert.equal(model.steps(r).reduce((sum, [, minutes]) => sum + minutes, 0), budget);
      assert.ok(Number.isInteger(r.matches));
      assert.equal(r.active + r.queueTime + r.breaks + r.extraBreaks, r.total);
      if (r.matches) {
        const next = r.coreTotal + r.config.matchLength + r.config.queue + r.config.breakMinutes;
        assert.ok(next > budget);
      } else if (!r.shortened) {
        assert.ok(r.coreTotal + r.config.matchLength + r.config.queue > budget);
      }
    }
  }
});
test("duration formatting keeps the remaining minutes", () => {
  assert.equal(model.format(0), "0 хв");
  assert.equal(model.format(60), "1 год");
  assert.equal(model.format(145), "2 год 25 хв");
});

test("exercise-only plan never inserts a match and reports shortened blocks", () => {
  const r = plan({ mode: "drills", budget: 30 });
  assert.equal(r.matches, 0);
  assert.deepEqual(model.steps(r), [["Розминка", 10], ["Вправи", 20]]);
  assert.deepEqual(model.reductions(r), ["Розбір: 15 хв → 0 хв"]);
  assert.equal(plan({ mode: "drills", budget: 120 }).matches, 0);
});

test("budget uses the same match cap as manual mode and flags unusually long plans", () => {
  const r = plan({ mode: "budget", budget: 180, warmup: 0, drills: 0, review: 0, matchLength: 5, queue: 0, breakMinutes: 0, days: 7 });
  assert.equal(r.matches, model.ranges.matches[1]);
  assert.equal(r.total, 180);
  assert.match(model.volumeWarning(r), /за тиждень/);
  assert.equal(model.volumeWarning(plan({})), "");
});
