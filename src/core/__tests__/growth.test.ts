/**
 * Validation of the fermentation clock against the table it was fitted to,
 * and against the qualitative behaviour a baker expects from the sliders.
 */

import { describe, expect, it } from 'vitest';
import table from './fermentation-table.json';
import {
  LEAVEN_PCT_MAX,
  LEAVEN_PCT_MIN,
  bulkHoursFor,
  doublingHoursAt,
  freshYeastToStarterPct,
  leavenPctFor,
  leavenPctForTotal,
  proofHoursAt,
  starterToFreshYeastPct,
  totalHoursFor,
} from '@/core/growth';
import { FULL_FERMENT_PCT } from '@/data/fermentationTable';

/** [tempC, starterPct, bulkHours, proofHours, overallHours] */
const POINTS = table as [number, number, number, number, number][];
const REFERENCE = { saltPct: 2, hydrationPct: 75, sugarPct: 0, fatPct: 0 };

describe('bulk time against every point in the source table', () => {
  it('reproduces all 64 measurements within 10%', () => {
    const errors: string[] = [];
    for (const [tempC, starter, bulk] of POINTS) {
      const predicted = bulkHoursFor(starter, { tempC, ...REFERENCE });
      const err = Math.abs(predicted - bulk) / bulk;
      if (err > 0.1) {
        errors.push(`${tempC}C/${starter}%: predicted ${predicted}h vs ${bulk}h (${(err * 100).toFixed(0)}%)`);
      }
    }
    expect(errors).toEqual([]);
  });

  it('has a mean absolute error under 3%', () => {
    const errs = POINTS.map(([tempC, starter, bulk]) => {
      const predicted = bulkHoursFor(starter, { tempC, ...REFERENCE });
      return Math.abs(predicted - bulk) / bulk;
    });
    const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
    expect(mean).toBeLessThan(0.03);
  });
});

describe('proof time against the table', () => {
  it('reproduces the measured proof hours within 15%', () => {
    for (const [tempC, , , proof] of POINTS) {
      const predicted = proofHoursAt(tempC);
      // Proof varies ~16% across the dose range; the model takes the mid column.
      expect(Math.abs(predicted - proof) / proof, `${tempC}C`).toBeLessThan(0.15);
    }
  });
});

describe('the inverse is an exact inverse', () => {
  it('round-trips dose → time → dose at every table point', () => {
    for (const [tempC, starter] of POINTS) {
      const hours = bulkHoursFor(starter, { tempC, ...REFERENCE });
      const back = leavenPctFor(hours, { tempC, ...REFERENCE });
      // Both directions round to two decimals, so compare relatively rather
      // than absolutely — a 0.005 h rounding is worth 0.3% of the dose at the
      // warm end, where a doubling is only 1.2 h.
      expect(Math.abs(back - starter) / starter, `${tempC}C/${starter}%`).toBeLessThan(0.01);
    }
  });

  it('round-trips time → dose → time across the useful range', () => {
    for (const tempC of [12, 18, 21, 24, 28]) {
      for (const hours of [2, 4, 6, 9, 14, 20, 30]) {
        const dose = leavenPctFor(hours, { tempC, ...REFERENCE });
        if (dose <= LEAVEN_PCT_MIN || dose >= LEAVEN_PCT_MAX) continue;
        const back = bulkHoursFor(dose, { tempC, ...REFERENCE });
        expect(back, `${tempC}C/${hours}h`).toBeCloseTo(hours, 0);
      }
    }
  });

  it('round-trips through the total, proof included', () => {
    for (const tempC of [18, 22, 26]) {
      for (const total of [6, 10, 16]) {
        const dose = leavenPctForTotal(total, { tempC, ...REFERENCE });
        if (dose <= LEAVEN_PCT_MIN || dose >= LEAVEN_PCT_MAX) continue;
        expect(totalHoursFor(dose, { tempC, ...REFERENCE }), `${tempC}C/${total}h`).toBeCloseTo(total, 0);
      }
    }
  });
});

describe('the behaviour a baker expects from the sliders', () => {
  const at = (tempC: number) => ({ tempC, ...REFERENCE });

  it('more leavening always means less time', () => {
    for (const tempC of [10, 16, 21, 25, 30]) {
      let previous = Infinity;
      for (const dose of [0.5, 1, 2, 5, 10, 20, 40]) {
        const hours = bulkHoursFor(dose, at(tempC));
        expect(hours, `${tempC}C/${dose}%`).toBeLessThan(previous);
        previous = hours;
      }
    }
  });

  it('warmer always means less time', () => {
    for (const dose of [1, 5, 20]) {
      let previous = Infinity;
      for (const tempC of [8, 12, 16, 20, 24, 28]) {
        const hours = bulkHoursFor(dose, at(tempC));
        expect(hours, `${dose}%/${tempC}C`).toBeLessThan(previous);
        previous = hours;
      }
    }
  });

  it('a longer target time always asks for less leavening', () => {
    for (const tempC of [16, 21, 26]) {
      let previous = Infinity;
      for (const hours of [3, 5, 8, 12, 18, 26]) {
        const dose = leavenPctFor(hours, at(tempC));
        // Once the floor is reached the answer stops moving, which is the
        // honest response: no weighable amount of starter stretches a warm
        // room that far. Monotonicity is only meaningful above it.
        if (dose <= LEAVEN_PCT_MIN) break;
        expect(dose, `${tempC}C/${hours}h`).toBeLessThan(previous);
        previous = dose;
      }
    }
  });

  it('bottoms out rather than pretending a warm room can be stretched forever', () => {
    // 26 °C and 18 h needs less starter than anyone can weigh; the model says so
    // by pinning to the floor instead of returning a fantasy number.
    expect(leavenPctFor(18, at(26))).toBe(LEAVEN_PCT_MIN);
    expect(leavenPctFor(8, at(26))).toBeGreaterThan(LEAVEN_PCT_MIN);
  });

  it('a colder room always asks for more leavening to hit the same time', () => {
    let previous = 0;
    for (const tempC of [28, 24, 20, 16, 12]) {
      const dose = leavenPctFor(8, at(tempC));
      expect(dose, `${tempC}C`).toBeGreaterThan(previous);
      previous = dose;
    }
  });

  it('saves a fixed number of hours per doubling, whatever the dose', () => {
    // The signature of a logarithmic law: 1→2% saves as much as 10→20%.
    const tempC = 21.1;
    const lowStep = bulkHoursFor(1, at(tempC)) - bulkHoursFor(2, at(tempC));
    const highStep = bulkHoursFor(10, at(tempC)) - bulkHoursFor(20, at(tempC));
    expect(lowStep).toBeCloseTo(highStep, 1);
    expect(lowStep).toBeCloseTo(doublingHoursAt(tempC), 1);
  });

  it('is not the inverse-proportional law it replaced', () => {
    // 50× the dose buys about 3.7× the speed, not 50×.
    const tempC = 21.1;
    const slow = bulkHoursFor(0.5, at(tempC));
    const fast = bulkHoursFor(25, at(tempC));
    expect(slow / fast).toBeGreaterThan(3);
    expect(slow / fast).toBeLessThan(4.5);
  });
});

describe('corrections stretch the clock in the right direction', () => {
  const base = { tempC: 22, saltPct: 2, hydrationPct: 75, sugarPct: 0, fatPct: 0 };

  it('more salt means a longer ferment', () => {
    expect(bulkHoursFor(10, { ...base, saltPct: 3 })).toBeGreaterThan(bulkHoursFor(10, base));
  });

  it('a wetter dough ferments faster', () => {
    expect(bulkHoursFor(10, { ...base, hydrationPct: 85 })).toBeLessThan(bulkHoursFor(10, base));
  });

  it('a rich dough ferments slower', () => {
    expect(bulkHoursFor(10, { ...base, fatPct: 20 })).toBeGreaterThan(bulkHoursFor(10, base));
  });

  it('heavy sugar slows it down', () => {
    expect(bulkHoursFor(10, { ...base, sugarPct: 20 })).toBeGreaterThan(bulkHoursFor(10, base));
  });
});

describe('the starter-equivalent currency', () => {
  it('converts yeast to starter and back without drift', () => {
    for (const pct of [0.02, 0.1, 0.5, 1, 2]) {
      expect(starterToFreshYeastPct(freshYeastToStarterPct(pct))).toBeCloseTo(pct, 6);
    }
  });
});

describe('guardrails', () => {
  it('never returns a non-finite or negative time', () => {
    for (const tempC of [-10, 0, 5, 21, 40, 60]) {
      for (const dose of [0, 0.001, 1, 50, 99, 1000]) {
        const h = bulkHoursFor(dose, { tempC, ...REFERENCE });
        expect(Number.isFinite(h), `${tempC}C/${dose}%`).toBe(true);
        expect(h).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the dose inside practical limits whatever time is asked for', () => {
    for (const hours of [0.01, 1, 100, 1000]) {
      const dose = leavenPctFor(hours, { tempC: 21, ...REFERENCE });
      expect(dose).toBeGreaterThanOrEqual(LEAVEN_PCT_MIN);
      expect(dose).toBeLessThanOrEqual(LEAVEN_PCT_MAX);
    }
  });

  it('floors bulk instead of claiming a dough is ready before it is mixed', () => {
    // At the full-ferment dose the curve itself reaches zero, but gas still has
    // to build a structure, so the answer bottoms out near half a doubling.
    for (const tempC of [18, 21, 26]) {
      const floored = bulkHoursFor(FULL_FERMENT_PCT, { tempC, ...REFERENCE });
      expect(floored).toBeGreaterThan(0);
      expect(floored).toBeCloseTo(0.4 * doublingHoursAt(tempC), 1);
    }
  });

  it('still shortens with dose right up to the floor', () => {
    const at = { tempC: 24, ...REFERENCE };
    expect(bulkHoursFor(40, at)).toBeLessThan(bulkHoursFor(20, at));
    expect(bulkHoursFor(60, at)).toBeLessThanOrEqual(bulkHoursFor(40, at));
  });
});

describe('the warm proof is never allowed to run past the measured window', () => {
  it('caps a warm final proof and gives the surplus back to bulk', async () => {
    const { calculateRecipe } = await import('@/core/calculations');
    const { getStyleById } = await import('@/data/styles');
    const style = getStyleById('country_sourdough')!;

    const r = calculateRecipe({
      style,
      driver: 'dose',
      leavenPct: 5,
      ballWeight: 900,
      ballCount: 1,
      totalTime: 0,
      roomTemp: 24,
      coldHours: 0,
      leavenType: 'sourdough',
      yeastForm: 'instant',
      mixing: 'hand',
      desiredDoughTemp: 25,
      startTime: new Date('2026-03-14T09:00:00Z'),
    });

    // Left to the style ratio alone this proof would run past six hours at
    // 24 °C, which over-proofs a shaped loaf.
    expect(r.fermentation.proofHours).toBeLessThanOrEqual(proofHoursAt(24) * 1.2);
    // The hours are moved, not lost.
    expect(r.fermentation.bulkHours + r.fermentation.proofHours).toBeCloseTo(
      r.fermentation.totalHours,
      1,
    );
  });

  it('leaves a long cold retard alone, because that is the point of it', async () => {
    const { calculateRecipe } = await import('@/core/calculations');
    const { getStyleById } = await import('@/data/styles');
    const style = getStyleById('ny_style')!;

    const r = calculateRecipe({
      style,
      ballWeight: 280,
      ballCount: 4,
      totalTime: 48,
      coldHours: 44,
      coldPhase: 'proof',
      roomTemp: 21,
      leavenType: 'commercial',
      yeastForm: 'instant',
      mixing: 'hand',
      desiredDoughTemp: 24,
      startTime: new Date('2026-03-14T09:00:00Z'),
    });

    expect(r.fermentation.proofHours).toBeGreaterThan(30);
  });
});
