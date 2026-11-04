const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../js/training-model.js");
const plan = changes => model.calculate({ ...model.defaults, ...changes });

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
  assert.equal(below.remaining, 54);
});
test("insufficient match budget creates a skills session, not a partial match", () => {
  const r = plan({ mode: "budget", budget: 89 });
  assert.equal(r.matches, 0);
  assert.equal(r.total, 45);
  assert.equal(r.queueTime, 0);
  assert.equal(r.breaks, 0);
  assert.equal(r.remaining, 44);
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
test("a session cannot exceed the minutes in one day", () => {
  assert.throws(() => plan({ matches: 50, matchLength: 180 }), /24/);
});
test("a budget with no possible training blocks produces a useful error", () => {
  assert.throws(() => plan({ mode: "budget", budget: 1, warmup: 0, drills: 0, review: 0 }), /блок/);
});
test("inactive fields cannot change or invalidate a plan", () => {
  assert.equal(plan({ budget: "" }).total, 145);
  assert.equal(plan({ mode: "budget", budget: 145, matches: "bad" }).total, 145);
});
test("game and focus survive the result/edit URL round trip", () => {
  const expected = plan({ game: "Dota 2", focus: "lane", matchLength: 45 });
  const restored = model.calculate(model.parse(model.serialize(expected.config)));
  assert.deepEqual(restored, expected);
});
test("across budgets, allocated time fits and another full match never fits", () => {
  for (const game of Object.keys(model.games)) {
    const focus = Object.keys(model.games[game].focuses)[0];
    for (let budget = 1; budget <= 1440; budget++) {
      const r = plan({ mode: "budget", game, focus, budget, matchLength: model.games[game].matchLength });
      assert.ok(r.total <= budget);
      assert.equal(r.total + r.remaining, budget);
      assert.ok(Number.isInteger(r.matches));
      assert.equal(r.active + r.queueTime + r.breaks, r.total);
      if (r.matches) {
        const next = r.total + r.config.matchLength + r.config.queue + r.config.breakMinutes;
        assert.ok(next > budget);
      } else if (!r.shortened) {
        assert.ok(r.total + r.config.matchLength + r.config.queue > budget);
      }
    }
  }
});
test("duration formatting keeps the remaining minutes", () => {
  assert.equal(model.format(0), "0 хв");
  assert.equal(model.format(60), "1 год");
  assert.equal(model.format(145), "2 год 25 хв");
});
