/**
 * Calibration tests.
 *
 * These pin the model to published figures from real bakers rather than to its
 * own internal consistency. If a constant is retuned and one of these breaks,
 * the model has drifted away from what actually happens on a bench.
 *
 * Sources:
 *  - Full Proof Baking, "How To Make A Basic Open Crumb Sourdough Bread" (2020)
 *  - Russell Peace Baker, "The Ultimate Guide to Sourdough Starters"
 */

import { describe, expect, it } from 'vitest';
import { BREAD_STYLES, getStyleById } from '@/data/styles';
import { calculateRecipe } from '@/core/calculations';
import { computeRoomEquivHours, starterPeakHours } from '@/core/fermentation';
import { Q10, rateRatio } from '@/core/constants';

const START = new Date('2026-03-14T09:00:00Z');

describe('Full Proof Baking — bulk times at a fixed 20% levain', () => {
  // Published: 7 h at 70 °F, 6 h at 74 °F, 4.5–5 h at 80 °F.
  const REFERENCE: { tempC: number; hours: number; tolerance: number }[] = [
    { tempC: 21.1, hours: 7, tolerance: 0.4 },
    { tempC: 23.3, hours: 6, tolerance: 0.2 },
    { tempC: 26.7, hours: 4.75, tolerance: 0.4 },
  ];

  it('reproduces every published bulk time from the 23.3 °C anchor', () => {
    for (const { tempC, hours, tolerance } of REFERENCE) {
      // Holding the dose fixed, required time scales as the inverse of the rate.
      const predicted = 6 * rateRatio(23.3, tempC);
      expect(Math.abs(predicted - hours), `${tempC} °C`).toBeLessThanOrEqual(tolerance);
    }
  });

  it('uses a dough Q10 that matches the published spread', () => {
    // Two independent pairs from the source both imply Q10 ≈ 2.0.
    const fromCool = (7 / 6) ** (10 / (23.3 - 21.1));
    const fromWarm = (6 / 4.75) ** (10 / (26.7 - 23.3));
    expect(Q10).toBeGreaterThan(Math.min(fromCool, fromWarm) - 0.15);
    expect(Q10).toBeLessThan(Math.max(fromCool, fromWarm) + 0.15);
  });
});

describe("Full Proof Baking — the recipe's own numbers", () => {
  // 325 g dough flour (70 g whole wheat + 255 g bread), 253 g water,
  // 7.5 g salt, 65 g levain at 100% hydration.
  const DOUGH_FLOUR = 325;
  const LEVAIN = 65;
  const TOTAL_FLOUR = DOUGH_FLOUR + LEVAIN / 2;

  const build = () =>
    calculateRecipe({
      style: getStyleById('country_sourdough')!,
      scaleMode: 'flour',
      targetFlour: TOTAL_FLOUR,
      ballWeight: 0,
      ballCount: 1,
      // Their schedule: ~6 h bulk at 23.3 °C, then ~14 h at 3.3 °C.
      totalTime: 20,
      coldHours: 14,
      coldTemp: 3.3,
      coldPhase: 'proof',
      roomTemp: 23.3,
      hydration: 79.9,
      salt: 2.1,
      leavenType: 'sourdough',
      yeastForm: 'instant',
      mixing: 'hand',
      desiredDoughTemp: 25,
      startTime: START,
    });

  it('agrees that their schedule is worth about 9 room-equivalent hours', () => {
    const equiv = computeRoomEquivHours({
      totalHours: 20,
      coldHours: 14,
      roomTemp: 23.3,
      coldTemp: 3.3,
    });
    expect(equiv).toBeGreaterThan(7.5);
    expect(equiv).toBeLessThan(10.5);
  });

  it("lands within a couple of points of the recipe's 20% levain on dough flour", () => {
    const r = build();
    expect(r.fermentation.levainOnFlourPct).toBeGreaterThan(16);
    expect(r.fermentation.levainOnFlourPct).toBeLessThan(24);
  });

  it("reproduces the recipe's 2.1% salt on total flour", () => {
    const r = build();
    const salt = r.ingredients.find((i) => i.type === 'salt')!;
    expect(salt.percentage).toBeCloseTo(2.1, 1);
    expect(salt.grams).toBeCloseTo(7.5, 0);
  });

  it('reproduces their total flour and hydration', () => {
    const r = build();
    expect(r.totals.flour).toBeCloseTo(TOTAL_FLOUR, 0);
    const water = r.ingredients
      .filter((i) => i.type === 'water')
      .reduce((sum, i) => sum + i.grams, 0);
    expect((water / r.totals.flour) * 100).toBeCloseTo(79.9, 0);
  });

  it('reports the levain in both conventions without confusing them', () => {
    const r = build();
    const f = r.fermentation;
    // Starter flour on total flour is always the smaller of the two.
    expect(f.inoculationPct).toBeLessThan(f.levainOnFlourPct);

    // With a 100%-hydration starter, i% of the total flour as starter flour
    // means 2i% of the total as levain — but the levain is quoted against the
    // flour it joins, which excludes its own flour: 2i / (100 − i).
    const i = f.inoculationPct;
    expect(f.levainOnFlourPct).toBeCloseTo((2 * i * 100) / (100 - i), 0);
  });
});

describe('Russell Peace Baker — starter peak times', () => {
  // Published windows for the same ratio and hydration.
  const WINDOWS: { tempC: number; min: number; max: number }[] = [
    { tempC: 18, min: 10, max: 14 },
    { tempC: 22, min: 6, max: 8 },
    { tempC: 26, min: 3, max: 5 },
  ];

  it('predicts a peak inside every published window', () => {
    for (const { tempC, min, max } of WINDOWS) {
      const hours = starterPeakHours(tempC);
      expect(hours, `${tempC} °C`).toBeGreaterThanOrEqual(min);
      expect(hours, `${tempC} °C`).toBeLessThanOrEqual(max);
    }
  });

  it('is steeper than the dough curve, which would badly misjudge a cold kitchen', () => {
    // The dough coefficient applied to a starter predicts a peak far too fast
    // at 18 °C — the mistake this separate constant exists to avoid.
    const doughModel = 7 * rateRatio(22, 18);
    expect(doughModel).toBeLessThan(10);
    expect(starterPeakHours(18)).toBeGreaterThanOrEqual(10);
  });

  it('never promises an absurdly fast or slow peak', () => {
    expect(starterPeakHours(40)).toBeGreaterThanOrEqual(2);
    expect(starterPeakHours(2)).toBeLessThanOrEqual(24);
  });
});

describe('the schedule tells the truth about the levain build', () => {
  const buildAt = (roomTemp: number) => {
    const style = getStyleById('country_sourdough')!;
    return calculateRecipe({
      style,
      ballWeight: style.defaults.ballWeight,
      ballCount: style.defaults.ballCount,
      totalTime: style.defaults.totalTime,
      roomTemp,
      coldHours: style.defaults.coldHours,
      leavenType: 'sourdough',
      yeastForm: 'instant',
      mixing: 'hand',
      desiredDoughTemp: style.defaults.doughTemp,
      startTime: START,
    });
  };

  it('gives a cold kitchen a longer levain build than a warm one', () => {
    const cold = buildAt(18);
    const warm = buildAt(27);
    const levainStep = (r: ReturnType<typeof buildAt>) =>
      r.timeline.find((s) => s.phase === 'levain')!;
    expect(levainStep(cold).durationMin).toBeGreaterThan(levainStep(warm).durationMin * 1.8);
  });

  it('quotes the build against the baker\'s own room, not the style reference', () => {
    const r = buildAt(18);
    const step = r.timeline.find((s) => s.phase === 'levain')!;
    expect(step.values?.temp).toBe(18);
    expect(step.values?.hours).toBe(r.fermentation.levainPeakHours);
  });

  it('starts the levain early enough to be ripe when the dough is mixed', () => {
    const r = buildAt(20);
    const levain = r.timeline.find((s) => s.phase === 'levain')!;
    const mix = r.timeline.find((s) => s.phase === 'mix')!;
    expect(levain.offsetMin + levain.durationMin).toBeLessThanOrEqual(mix.offsetMin);
  });
});

describe('the levain section header matches the schedule', () => {
  it('quotes the build against the room, not the calibration reference', () => {
    const style = getStyleById('country_sourdough')!;
    const r = calculateRecipe({
      style,
      ballWeight: style.defaults.ballWeight,
      ballCount: style.defaults.ballCount,
      totalTime: style.defaults.totalTime,
      roomTemp: 19,
      coldHours: style.defaults.coldHours,
      leavenType: 'sourdough',
      yeastForm: 'instant',
      mixing: 'hand',
      desiredDoughTemp: style.defaults.doughTemp,
      startTime: START,
    });
    const section = r.sections.find((s) => s.id === 'levain')!;
    const step = r.timeline.find((s) => s.phase === 'levain')!;

    expect(section.meta!.tempC).toBe(19);
    expect(section.meta!.hours).toBe(r.fermentation.levainPeakHours);
    expect(section.meta!.hours).toBe(step.values!.hours);
    // 19 °C is well below the style's 23 °C reference, so the build must be longer.
    expect(section.meta!.hours).toBeGreaterThan(style.fermentation.levain_ref_hours!);
  });
});

describe('Russell Peace Baker — "The Mighty White"', () => {
  // 400 g flour, 270 g water to start, 80 g starter at 100%, 8 g salt.
  // The recipe states its basis: "Baker's percentages are based on flour added
  // directly to the dough (400 g), not including starter flour."
  const DOUGH_FLOUR = 400;
  const TOTAL_FLOUR = DOUGH_FLOUR + 80 / 2;

  const build = (percentBasis: 'total' | 'dough') => {
    const style = getStyleById('strong_white_sourdough')!;
    return calculateRecipe({
      style,
      scaleMode: 'flour',
      targetFlour: percentBasis === 'dough' ? TOTAL_FLOUR : TOTAL_FLOUR,
      ballWeight: 0,
      ballCount: 1,
      percentBasis,
      hydration: percentBasis === 'dough' ? 67.5 : 70.5,
      salt: percentBasis === 'dough' ? 2 : 1.8,
      totalTime: 7,
      coldHours: 0,
      roomTemp: 27,
      leavenType: 'sourdough',
      yeastForm: 'instant',
      mixing: 'hand',
      desiredDoughTemp: 28,
      startTime: START,
    });
  };

  it('reads 2% salt and 67.5% hydration on the dough basis, as written', () => {
    const r = build('dough');
    expect(r.params.percentBasis).toBe('dough');

    const salt = r.ingredients.find((i) => i.type === 'salt')!;
    expect(salt.percentage).toBeCloseTo(2, 1);
    expect(salt.grams).toBeCloseTo(8, 0);

    // 67.5% of 400 g of dough flour is the 270 g they start the autolyse with.
    const doughWater = r.sections
      .find((s) => s.id === 'final')!
      .ingredients.filter((i) => i.type === 'water')
      .reduce((sum, i) => sum + i.grams, 0);
    expect(doughWater).toBeCloseTo(270, -1);
  });

  it('reads the same loaf as 1.8% salt on the total basis', () => {
    const r = build('total');
    const salt = r.ingredients.find((i) => i.type === 'salt')!;
    expect(salt.percentage).toBeCloseTo(1.8, 1);
    expect(salt.grams).toBeCloseTo(8, 0);
  });

  it('weighs out the same grams either way — only the denominator moves', () => {
    const dough = build('dough');
    const total = build('total');

    const grams = (r: typeof dough, type: string) =>
      r.ingredients.filter((i) => i.type === type).reduce((sum, i) => sum + i.grams, 0);

    // The two builds are given hand-converted equivalents (2% of dough flour vs
    // 1.8% of total), so they agree to the precision of that conversion rather
    // than exactly. What matters is that the same loaf comes out of both.
    const within = (a: number, b: number, pct: number) =>
      Math.abs(a - b) / Math.max(a, b) < pct / 100;

    expect(within(grams(dough, 'salt'), grams(total, 'salt'), 1.5)).toBe(true);
    expect(within(grams(dough, 'water'), grams(total, 'water'), 1.5)).toBe(true);
    expect(dough.totals.flour).toBeCloseTo(total.totals.flour, 0);
  });

  it('quotes the starter at the 20% the recipe states', () => {
    const r = build('dough');
    expect(r.fermentation.levainOnFlourPct).toBeGreaterThan(17);
    expect(r.fermentation.levainOnFlourPct).toBeLessThan(23);
  });

  it('reports which basis it used, so the two can never be confused', () => {
    expect(build('dough').notes.some((n) => n.code === 'note.percent_basis_dough')).toBe(true);
    expect(build('total').notes.some((n) => n.code === 'note.percent_basis_total')).toBe(true);
  });

  it('asks for 38 °C water to hit their 28 °C dough in a 22 °C kitchen', () => {
    const style = getStyleById('strong_white_sourdough')!;
    const r = calculateRecipe({
      style,
      ballWeight: 758,
      ballCount: 1,
      totalTime: 7,
      roomTemp: 22,
      flourTemp: 22,
      coldHours: 0,
      leavenType: 'sourdough',
      yeastForm: 'instant',
      mixing: 'hand',
      desiredDoughTemp: 28,
      startTime: START,
    });
    expect(r.water.tempC).toBeCloseTo(38, 0);
  });

  it("uses the style's own bulk-rise target rather than a global constant", () => {
    const style = getStyleById('strong_white_sourdough')!;
    expect(style.bulkRisePct).toEqual([30, 50]);

    const r = build('dough');
    const bulk = r.timeline.find((s) => s.key === 'process.bulk')!;
    expect(bulk.values!.riseMin).toBe(30);
    expect(bulk.values!.riseMax).toBe(50);
  });
});

describe('percentage basis, in general', () => {
  it('leaves a straight dough untouched — there is no starter flour to exclude', () => {
    const style = getStyleById('focaccia')!;
    const common = {
      style,
      ballWeight: style.defaults.ballWeight,
      ballCount: style.defaults.ballCount,
      totalTime: style.defaults.totalTime,
      roomTemp: style.defaults.roomTemp,
      coldHours: 0,
      leavenType: 'commercial' as const,
      yeastForm: 'instant' as const,
      mixing: 'hand' as const,
      desiredDoughTemp: style.defaults.doughTemp,
      startTime: START,
    };
    const total = calculateRecipe({ ...common, percentBasis: 'total' });
    const dough = calculateRecipe({ ...common, percentBasis: 'dough' });
    expect(dough.totals.flour).toBeCloseTo(total.totals.flour, 1);
    expect(dough.params.basisFlour).toBeCloseTo(total.params.basisFlour, 1);
  });

  it('still lands on the requested dough weight on either basis', () => {
    for (const style of BREAD_STYLES) {
      for (const percentBasis of ['total', 'dough'] as const) {
        const r = calculateRecipe({
          style,
          percentBasis,
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
        });
        const target = style.defaults.ballWeight * style.defaults.ballCount;
        expect(r.totals.doughWeight, `${style.id}/${percentBasis}`).toBeGreaterThan(target * 0.99);
        expect(r.totals.doughWeight, `${style.id}/${percentBasis}`).toBeLessThan(target * 1.01);
      }
    }
  });

  it('never produces a negative weight on the dough basis, even at 100% preferment', () => {
    const style = getStyleById('pizza_biga')!;
    const r = calculateRecipe({
      style,
      percentBasis: 'dough',
      ballWeight: style.defaults.ballWeight,
      ballCount: style.defaults.ballCount,
      totalTime: style.defaults.totalTime,
      roomTemp: style.defaults.roomTemp,
      coldHours: 0,
      leavenType: 'commercial',
      yeastForm: 'instant',
      mixing: 'hand',
      desiredDoughTemp: style.defaults.doughTemp,
      startTime: START,
    });
    for (const ing of r.ingredients) {
      expect(ing.grams, ing.key).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(ing.percentage), ing.key).toBe(true);
    }
  });
});
