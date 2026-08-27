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
import { getStyleById } from '@/data/styles';
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
