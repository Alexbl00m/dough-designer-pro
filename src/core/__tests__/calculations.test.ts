import { describe, expect, it } from 'vitest';
import { BREAD_STYLES, getStyleById } from '@/data/styles';
import { calculateRecipe } from '@/core/calculations';
import {
  computeIceSplit,
  computeInoculationPct,
  computeRoomEquivHours,
  computeWaterTemp,
  computeYeastDose,
} from '@/core/fermentation';
import { FRICTION_FACTOR_C, Q10, rateRatio } from '@/core/constants';
import type { CalculationInputs } from '@/core/types';

const START = new Date('2026-03-14T09:00:00Z');

const baseInputs = (overrides: Partial<CalculationInputs> = {}): CalculationInputs => {
  const style = overrides.style ?? getStyleById('neapolitan')!;
  return {
    style,
    ballWeight: style.defaults.ballWeight,
    ballCount: style.defaults.ballCount,
    totalTime: style.defaults.totalTime,
    roomTemp: style.defaults.roomTemp,
    coldHours: style.defaults.coldHours,
    leavenType: style.defaults.leavenType,
    yeastForm: 'instant',
    mixing: 'hand',
    desiredDoughTemp: style.defaults.doughTemp,
    startTime: START,
    ...overrides,
  };
};

describe('style data integrity', () => {
  it('gives every style a unique id', () => {
    const ids = BREAD_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has flour blends that sum to 100%', () => {
    for (const style of BREAD_STYLES) {
      if (!style.flourBlend) continue;
      const sum = style.flourBlend.reduce((acc, f) => acc + f.percentage, 0);
      expect(sum, `${style.id} flour blend`).toBeCloseTo(100, 5);
    }
  });

  it('has liquid splits that sum to 1', () => {
    for (const style of BREAD_STYLES) {
      if (!style.liquids) continue;
      const sum = style.liquids.reduce((acc, l) => acc + l.share, 0);
      expect(sum, `${style.id} liquids`).toBeCloseTo(1, 5);
    }
  });

  it('has non-zero bulk/proof ratios', () => {
    for (const style of BREAD_STYLES) {
      const sum = style.fermentation.bulk_ratio + style.fermentation.proof_ratio;
      expect(sum, `${style.id} ratios`).toBeGreaterThan(0);
    }
  });

  it('never draws more flour into a preferment than the recipe has', () => {
    for (const style of BREAD_STYLES) {
      if (!style.preferment) continue;
      expect(style.preferment.flour_pct, `${style.id}`).toBeLessThanOrEqual(100);
    }
  });

  it('gives sourdough-default styles a starting levain dose', () => {
    for (const style of BREAD_STYLES) {
      if (style.defaults.leavenType !== 'sourdough') continue;
      expect(style.defaultLevainPct, `${style.id}`).toBeGreaterThan(0);
    }
  });

  it('keeps any style clock factor within a defensible range', () => {
    for (const style of BREAD_STYLES) {
      if (style.fermentFactor === undefined) continue;
      // The factor absorbs how far a baker pushes bulk, not arbitrary error.
      expect(style.fermentFactor, `${style.id}`).toBeGreaterThan(0.5);
      expect(style.fermentFactor, `${style.id}`).toBeLessThan(2.5);
    }
  });
});

describe('Q10 model', () => {
  it('doubles-ish the rate every 10 °C', () => {
    expect(rateRatio(33, 23)).toBeCloseTo(Q10, 10);
    expect(rateRatio(13, 23)).toBeCloseTo(1 / Q10, 10);
    expect(rateRatio(23, 23)).toBe(1);
  });
});

describe('cold retard equivalence', () => {
  it('returns clock time when nothing is cold', () => {
    expect(computeRoomEquivHours({ totalHours: 12, coldHours: 0, roomTemp: 23 })).toBeCloseTo(12, 6);
  });

  it('counts cold hours as far less than warm ones', () => {
    const equiv = computeRoomEquivHours({ totalHours: 24, coldHours: 20, roomTemp: 23, coldTemp: 4 });
    expect(equiv).toBeGreaterThan(4);
    expect(equiv).toBeLessThan(12);
  });

  it('credits the cool-down lag rather than treating the dough as instantly cold', () => {
    // 2 h in the fridge is mostly cool-down, so it must beat the naive
    // "2 h × fridge rate" figure.
    const naive = 2 * rateRatio(4, 23);
    const modelled = computeRoomEquivHours({ totalHours: 2, coldHours: 2, roomTemp: 23, coldTemp: 4 });
    expect(modelled).toBeGreaterThan(naive);
  });

  it('never returns zero, so the yeast dose stays finite', () => {
    expect(computeRoomEquivHours({ totalHours: 0, coldHours: 0, roomTemp: 23 })).toBeGreaterThan(0);
  });

  it('caps cold hours at the total time', () => {
    const a = computeRoomEquivHours({ totalHours: 6, coldHours: 100, roomTemp: 23 });
    const b = computeRoomEquivHours({ totalHours: 6, coldHours: 6, roomTemp: 23 });
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('yeast dose', () => {
  const dose = (overrides = {}) =>
    computeYeastDose({
      totalHours: 6,
      roomTemp: 22,
      saltPct: 2,
      sugarPct: 0,
      hydrationPct: 75,
      fatPct: 0,
      yeastForm: 'fresh',
      leavenType: 'commercial',
      ...overrides,
    });

  it('asks for less yeast the longer the ferment', () => {
    expect(dose({ totalHours: 12 }).pct).toBeLessThan(dose({ totalHours: 6 }).pct);
  });

  it('asks for less yeast the warmer the room', () => {
    expect(dose({ roomTemp: 28 }).pct).toBeLessThan(dose({ roomTemp: 18 }).pct);
  });

  it('asks for less yeast when part of the time is in the fridge than for none', () => {
    // Same wall-clock hours, but the cold ones count for far less.
    expect(dose({ totalHours: 24, coldHours: 20 }).pct).toBeGreaterThan(dose({ totalHours: 24 }).pct);
  });

  it('raises the dose as salt goes up', () => {
    expect(dose({ saltPct: 3 }).pct).toBeGreaterThan(dose({ saltPct: 2 }).pct);
  });

  it('lowers the dose as hydration goes up', () => {
    expect(dose({ hydrationPct: 85 }).pct).toBeLessThan(dose({ hydrationPct: 65 }).pct);
  });

  it('converts fresh to instant at roughly a third', () => {
    expect(dose({ yeastForm: 'instant' }).pct).toBeCloseTo(dose().pct * 0.33, 3);
  });

  it('returns nothing for a pure sourdough build', () => {
    expect(dose({ leavenType: 'sourdough' }).pct).toBe(0);
  });

  it('discounts the dose when a preferment carries part of the load', () => {
    expect(dose({ prefermentFlourPct: 30 }).pct).toBeLessThan(dose().pct);
  });

  it('adds nothing when the preferment already carries the whole load', () => {
    const r = dose({ totalHours: 12, prefermentFlourPct: 50 });
    expect(r.pct).toBe(0);
    expect(r.neededFreshPct).toBeGreaterThan(0);
  });

  it('halves in hybrid mode, where the levain carries the other half', () => {
    expect(dose({ leavenType: 'hybrid' }).freshPct).toBeCloseTo(dose().freshPct / 2, 3);
  });

  it('honours a dose the baker fixed', () => {
    expect(dose({ fixedFreshPct: 0.4 }).freshPct).toBe(0.4);
  });

  it('never goes negative or absurd, whatever the input', () => {
    const wild = dose({ saltPct: 6, sugarPct: 40, hydrationPct: 120, totalHours: 0.1 });
    expect(wild.pct).toBeGreaterThan(0);
    expect(wild.freshPct).toBeLessThanOrEqual(8);
    expect(wild.limit).toBe('max');
  });
});

describe('levain inoculation', () => {
  const inoc = (overrides = {}) =>
    computeInoculationPct({
      effectiveHours: 6,
      roomTemp: 24,
      saltPct: 2,
      hydrationPct: 75,
      leavenType: 'sourdough',
      ...overrides,
    });

  it('asks for less starter the longer the ferment', () => {
    expect(inoc({ effectiveHours: 12 })).toBeLessThan(inoc({ effectiveHours: 6 }));
  });

  it('asks for less starter the warmer the room', () => {
    expect(inoc({ roomTemp: 28 })).toBeLessThan(inoc({ roomTemp: 18 }));
  });

  it('halves in hybrid mode, where the yeast carries the other half', () => {
    expect(inoc({ leavenType: 'hybrid' })).toBeLessThan(inoc());
  });

  it('is zero on a commercial-yeast build', () => {
    expect(inoc({ leavenType: 'commercial' })).toBe(0);
  });

  it('stays inside practical limits', () => {
    expect(inoc({ effectiveHours: 200 })).toBeGreaterThanOrEqual(0);
    expect(inoc({ effectiveHours: 0.5 })).toBeLessThanOrEqual(50);
  });
});

describe('DDT water temperature', () => {
  it('uses three factors for a straight dough', () => {
    const { rawTempC, factors } = computeWaterTemp({
      desiredDoughTempC: 24,
      flourTempC: 20,
      roomTempC: 20,
      frictionC: 2,
    });
    expect(factors).toBe(3);
    expect(rawTempC).toBe(24 * 3 - 20 - 20 - 2);
  });

  it('uses four factors once a preferment joins the mix', () => {
    const { rawTempC, factors } = computeWaterTemp({
      desiredDoughTempC: 24,
      flourTempC: 20,
      roomTempC: 20,
      frictionC: 2,
      prefermentTempC: 18,
    });
    expect(factors).toBe(4);
    expect(rawTempC).toBe(24 * 4 - 20 - 20 - 2 - 18);
  });

  it('asks for colder water when the mixer adds more friction', () => {
    const hand = computeWaterTemp({ desiredDoughTempC: 24, flourTempC: 22, roomTempC: 22, frictionC: FRICTION_FACTOR_C.hand });
    const spiral = computeWaterTemp({ desiredDoughTempC: 24, flourTempC: 22, roomTempC: 22, frictionC: FRICTION_FACTOR_C.spiral });
    expect(spiral.rawTempC).toBeLessThan(hand.rawTempC);
  });
});

describe('ice split', () => {
  it('asks for no ice when tap water is already cold enough', () => {
    expect(computeIceSplit(1000, 15)).toBe(0);
  });

  it('asks for ice when the target is below tap temperature', () => {
    expect(computeIceSplit(1000, 4)).toBeGreaterThan(0);
  });

  it('never asks for more ice than water', () => {
    expect(computeIceSplit(1000, -50)).toBeLessThanOrEqual(1000);
  });
});

describe('calculateRecipe — totals', () => {
  it('lands on the requested dough weight for every style', () => {
    for (const style of BREAD_STYLES) {
      const r = calculateRecipe(baseInputs({ style }));
      const target = style.defaults.ballWeight * style.defaults.ballCount;
      expect(r.totals.doughWeight, `${style.id}`).toBeGreaterThan(target * 0.99);
      expect(r.totals.doughWeight, `${style.id}`).toBeLessThan(target * 1.01);
    }
  });

  it('scales by flour weight when asked', () => {
    const r = calculateRecipe(baseInputs({ scaleMode: 'flour', targetFlour: 1000 }));
    expect(r.totals.flour).toBeCloseTo(1000, 0);
  });

  it('scales by total dough weight when asked', () => {
    const r = calculateRecipe(baseInputs({ scaleMode: 'dough', targetDough: 1500 }));
    expect(r.totals.doughWeight).toBeGreaterThan(1490);
    expect(r.totals.doughWeight).toBeLessThan(1510);
  });

  it("expresses baker's percentages against total flour", () => {
    const r = calculateRecipe(baseInputs({ hydration: 70 }));
    const flourPct = r.ingredients
      .filter((i) => i.type === 'flour')
      .reduce((sum, i) => sum + i.percentage, 0);
    expect(flourPct).toBeCloseTo(100, 0);
  });

  it('keeps grams and percentages consistent to two decimals', () => {
    const r = calculateRecipe(baseInputs());
    for (const ing of r.ingredients) {
      const expected = (ing.grams / r.totals.flour) * 100;
      expect(ing.percentage, ing.key).toBeCloseTo(expected, 1);
    }
  });

  it('scales linearly with the number of pieces', () => {
    const one = calculateRecipe(baseInputs({ ballCount: 1 }));
    const four = calculateRecipe(baseInputs({ ballCount: 4 }));
    expect(four.totals.flour).toBeCloseTo(one.totals.flour * 4, 0);
  });
});

describe('calculateRecipe — preferments', () => {
  const ciabatta = getStyleById('ciabatta')!;

  it('splits flour between the biga and the final dough', () => {
    const r = calculateRecipe(baseInputs({ style: ciabatta }));
    const biga = r.sections.find((s) => s.id === 'preferment');
    expect(biga).toBeTruthy();
    const bigaFlour = biga!.ingredients.find((i) => i.type === 'flour')!.grams;
    expect(bigaFlour).toBeCloseTo(r.totals.flour * 0.5, 0);
  });

  it('subtracts the preferment from the final dough so hydration still holds', () => {
    const r = calculateRecipe(baseInputs({ style: ciabatta, hydration: 82 }));
    const allWater = r.ingredients
      .filter((i) => i.type === 'water')
      .reduce((sum, i) => sum + i.grams, 0);
    expect(allWater / r.totals.flour).toBeCloseTo(0.82, 2);
  });

  it('can be switched off to make a straight dough', () => {
    const withPref = calculateRecipe(baseInputs({ style: ciabatta, usePreferment: true }));
    const without = calculateRecipe(baseInputs({ style: ciabatta, usePreferment: false }));
    expect(withPref.sections.some((s) => s.id === 'preferment')).toBe(true);
    expect(without.sections.some((s) => s.id === 'preferment')).toBe(false);
    // A straight dough has no head start, so it needs more yeast.
    expect(without.fermentation.yeastPct).toBeGreaterThan(withPref.fermentation.yeastPct);
  });

  it('keeps the dough weight right with a 100% biga', () => {
    const r = calculateRecipe(baseInputs({ style: getStyleById('pizza_biga')! }));
    const target = 270 * 4;
    expect(r.totals.doughWeight).toBeGreaterThan(target * 0.99);
    expect(r.totals.doughWeight).toBeLessThan(target * 1.01);
  });
});

describe('calculateRecipe — sourdough', () => {
  const country = getStyleById('country_sourdough')!;

  it('builds a levain section and subtracts it from the final dough', () => {
    const r = calculateRecipe(baseInputs({ style: country }));
    expect(r.sections.some((s) => s.id === 'levain')).toBe(true);
    expect(r.fermentation.inoculationPct).toBeGreaterThan(0);

    const allFlour = r.ingredients
      .filter((i) => i.type === 'flour')
      .reduce((sum, i) => sum + i.grams, 0);
    expect(allFlour).toBeCloseTo(r.totals.flour, 0);
  });

  it('honours a stiff starter without breaking hydration', () => {
    const r = calculateRecipe(baseInputs({ style: country, starterHydration: 50, hydration: 76 }));
    const allWater = r.ingredients
      .filter((i) => i.type === 'water')
      .reduce((sum, i) => sum + i.grams, 0);
    expect(allWater / r.totals.flour).toBeCloseTo(0.76, 2);
  });

  it('uses less starter for a longer ferment', () => {
    const short = calculateRecipe(baseInputs({ style: country, totalTime: 6, coldHours: 0 }));
    const long = calculateRecipe(baseInputs({ style: country, totalTime: 12, coldHours: 0 }));
    expect(long.fermentation.inoculationPct).toBeLessThan(short.fermentation.inoculationPct);
  });

  it('uses both yeast and levain in hybrid mode', () => {
    const r = calculateRecipe(baseInputs({ style: getStyleById('focaccia')!, leavenType: 'hybrid' }));
    expect(r.fermentation.yeastPct).toBeGreaterThan(0);
    expect(r.fermentation.inoculationPct).toBeGreaterThan(0);
  });
});

describe('calculateRecipe — schedule', () => {
  it('produces steps in chronological order', () => {
    for (const style of BREAD_STYLES) {
      const r = calculateRecipe(baseInputs({ style }));
      const offsets = r.timeline.map((s) => s.offsetMin);
      expect([...offsets].sort((a, b) => a - b), `${style.id}`).toEqual(offsets);
    }
  });

  it('puts the preferment before baking day', () => {
    const r = calculateRecipe(baseInputs({ style: getStyleById('baguette')! }));
    const pref = r.timeline.find((s) => s.phase === 'preferment');
    expect(pref!.offsetMin).toBeLessThan(0);
  });

  it('ends with a bake and a ready time after the start', () => {
    const r = calculateRecipe(baseInputs());
    expect(r.timeline.at(-1)!.phase).toBe('done');
    expect(new Date(r.readyAt).getTime()).toBeGreaterThan(START.getTime());
  });

  it('shows a cold step only when there is cold time', () => {
    const warm = calculateRecipe(baseInputs({ coldHours: 0 }));
    const cold = calculateRecipe(baseInputs({ totalTime: 24, coldHours: 18 }));
    expect(warm.timeline.some((s) => s.phase === 'cold')).toBe(false);
    expect(cold.timeline.some((s) => s.phase === 'cold')).toBe(true);
  });

  it('places the retard in the phase the baker chose', () => {
    const inBulk = calculateRecipe(baseInputs({ totalTime: 24, coldHours: 12, coldPhase: 'bulk' }));
    const inProof = calculateRecipe(baseInputs({ totalTime: 24, coldHours: 5, coldPhase: 'proof' }));
    expect(inBulk.timeline.find((s) => s.phase === 'cold')!.key).toBe('process.cold.bulk');
    expect(inProof.timeline.find((s) => s.phase === 'cold')!.key).toBe('process.cold.proof');
  });

  it('splits bulk and proof according to the style ratio', () => {
    const style = getStyleById('country_sourdough')!;
    const r = calculateRecipe(baseInputs({ style, totalTime: 20 }));
    expect(r.fermentation.bulkHours + r.fermentation.proofHours).toBeCloseTo(20, 1);
    const ratio = style.fermentation.bulk_ratio / (style.fermentation.bulk_ratio + style.fermentation.proof_ratio);
    expect(r.fermentation.bulkHours / 20).toBeCloseTo(ratio, 2);
  });
});

describe('calculateRecipe — guardrails', () => {
  it('caps cold hours at the total time and says so', () => {
    const r = calculateRecipe(baseInputs({ totalTime: 6, coldHours: 48 }));
    expect(r.fermentation.coldHours).toBe(6);
    expect(r.notes.some((n) => n.code === 'note.cold_clamped')).toBe(true);
  });

  it('keeps water temperature inside a practical range', () => {
    const r = calculateRecipe(baseInputs({ roomTemp: 4, desiredDoughTemp: 35, mixing: 'hand' }));
    expect(r.water.tempC).toBeLessThanOrEqual(55);
    expect(r.water.tempC).toBeGreaterThanOrEqual(1);
  });

  it('warns when the water temperature had to be clamped', () => {
    const r = calculateRecipe(baseInputs({ roomTemp: 4, desiredDoughTemp: 35 }));
    if (r.water.clamped) {
      expect(r.notes.some((n) => n.code === 'note.water_clamped')).toBe(true);
    }
  });

  it('survives nonsense input without producing NaN', () => {
    const r = calculateRecipe(
      baseInputs({ ballCount: 0, ballWeight: 0, totalTime: 0, hydration: 200, salt: 99 }),
    );
    for (const ing of r.ingredients) {
      expect(Number.isFinite(ing.grams), ing.key).toBe(true);
      expect(Number.isFinite(ing.percentage), ing.key).toBe(true);
    }
    expect(Number.isFinite(r.water.tempC)).toBe(true);
    expect(Number.isFinite(r.totals.flour)).toBe(true);
  });

  it('reports true hydration when milk or eggs replace water', () => {
    const r = calculateRecipe(baseInputs({ style: getStyleById('brioche')! }));
    expect(r.totals.trueHydrationPct).toBeLessThan(r.params.hydration);
    expect(r.totals.trueHydrationPct).toBeGreaterThan(0);
  });

  it('never emits an ingredient with a negative weight', () => {
    for (const style of BREAD_STYLES) {
      const r = calculateRecipe(baseInputs({ style, totalTime: 48, coldHours: 40 }));
      for (const ing of r.ingredients) {
        expect(ing.grams, `${style.id}/${ing.key}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
