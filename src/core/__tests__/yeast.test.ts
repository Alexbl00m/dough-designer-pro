/**
 * The commercial-yeast clock, pinned to the sources it was built from and to
 * the behaviour a baker expects from the sliders.
 *
 * Sources:
 *  - TXCraig1's yeast-prediction model (pizzamaking.com, topics 26831, 79284):
 *    0.048% instant yeast is ready in 12 h at 70 °F; the chart gives about
 *    0.64% for 24 h and 0.2% for 48 h at 39–40 °F.
 *  - The poolish rule of thumb: about 1.5% yeast for 3 h, 0.1% for 12–15 h.
 *  - Giorilli's biga: 1% fresh yeast, about 18 h at 18 °C.
 */

import { describe, expect, it } from 'vitest';
import {
  FRESH_YEAST_MAX_PCT,
  RIPE_PREFERMENT_POTENCY_PCT,
  YEAST_OPTIMUM_C,
  formToFresh,
  freshToForm,
  freshYeastFor,
  hoursForFreshYeast,
  prefermentLeavening,
  prefermentYeastFor,
  shortFermentFactor,
  yeastRateRatio,
} from '@/core/yeast';

const instant = (freshPct: number) => freshToForm(freshPct, 'instant');
const within = (value: number, target: number, tolerance: number) =>
  Math.abs(value - target) / target <= tolerance;

describe("TXCraig1's chart", () => {
  it('has 0.048% instant yeast ready in 12 h at 70 °F', () => {
    const dose = instant(freshYeastFor({ totalHours: 12, roomTempC: 21.1 }));
    expect(within(dose, 0.048, 0.03)).toBe(true);
  });

  it('reproduces the fridge column: about 0.64% for 24 h and 0.2% for 48 h at 39–40 °F', () => {
    const day = instant(freshYeastFor({ totalHours: 24, roomTempC: 4.2 }));
    const twoDays = instant(freshYeastFor({ totalHours: 48, roomTempC: 4.2 }));
    expect(within(day, 0.64, 0.15)).toBe(true);
    expect(within(twoDays, 0.2, 0.1)).toBe(true);
  });

  it('runs the fridge about ten times slower than 21 °C, as Gänzle’s curve does', () => {
    const ratio = yeastRateRatio(4, 21.1);
    expect(ratio).toBeGreaterThan(0.08);
    expect(ratio).toBeLessThan(0.12);
  });

  it('peaks near 35 °C', () => {
    expect(YEAST_OPTIMUM_C).toBeGreaterThan(34);
    expect(YEAST_OPTIMUM_C).toBeLessThan(35.5);
  });
});

describe('practice the curve has to agree with', () => {
  const lean = { saltPct: 2, hydrationPct: 65 };

  it('a 2% fresh-yeast straight dough is ready in 2–3 h at 25 °C', () => {
    const hours = hoursForFreshYeast(2, { roomTempC: 25 }, lean);
    expect(hours).toBeGreaterThan(2);
    expect(hours).toBeLessThan(3.2);
  });

  it('a 1% fresh-yeast pizza dough is ready in about four hours at 24 °C', () => {
    const hours = hoursForFreshYeast(1, { roomTempC: 24 });
    expect(hours).toBeGreaterThan(3);
    expect(hours).toBeLessThan(5);
  });

  it('a Neapolitan 24 h room ferment takes a pinch: about 0.06% fresh at 20 °C', () => {
    const hours = hoursForFreshYeast(0.06, { roomTempC: 20 });
    expect(hours).toBeGreaterThan(18);
    expect(hours).toBeLessThan(30);
  });
});

describe('the sliders behave the way a baker expects', () => {
  it('more yeast is always less time', () => {
    for (const roomTempC of [16, 20, 24, 28]) {
      let previous = Infinity;
      for (const dose of [0.01, 0.03, 0.1, 0.3, 1, 3]) {
        const hours = hoursForFreshYeast(dose, { roomTempC });
        expect(hours, `${roomTempC} °C / ${dose}%`).toBeLessThan(previous);
        previous = hours;
      }
    }
  });

  it('warmer is always less time, and never slower past the optimum', () => {
    for (const dose of [0.05, 0.3, 1.5]) {
      let previous = Infinity;
      for (const roomTempC of [8, 12, 16, 20, 24, 28, 32]) {
        const hours = hoursForFreshYeast(dose, { roomTempC });
        expect(hours, `${dose}% / ${roomTempC} °C`).toBeLessThan(previous);
        previous = hours;
      }
      expect(hoursForFreshYeast(dose, { roomTempC: 40 })).toBeLessThanOrEqual(previous);
    }
  });

  it('a longer schedule always asks for less yeast, a colder one for more', () => {
    let previous = Infinity;
    for (const totalHours of [2, 3, 4, 6, 8, 12, 24, 48, 72]) {
      const dose = freshYeastFor({ totalHours, roomTempC: 22 });
      expect(dose, `${totalHours} h`).toBeLessThan(previous);
      previous = dose;
    }
    previous = 0;
    for (const roomTempC of [28, 24, 20, 16, 12]) {
      const dose = freshYeastFor({ totalHours: 8, roomTempC });
      expect(dose, `${roomTempC} °C`).toBeGreaterThan(previous);
      previous = dose;
    }
  });

  it('counts fridge hours for far less than room hours', () => {
    const warm = freshYeastFor({ totalHours: 24, roomTempC: 21 });
    const cold = freshYeastFor({ totalHours: 24, roomTempC: 21, coldHours: 20, coldTempC: 4 });
    expect(cold).toBeGreaterThan(warm * 3);
  });

  it('is an exact inverse, fridge or not', () => {
    for (const coldHours of [0, 10, 40]) {
      for (const dose of [0.02, 0.1, 0.5, 2]) {
        const hours = hoursForFreshYeast(dose, { roomTempC: 21, coldHours, coldTempC: 4 });
        if (hours <= coldHours + 1e-6) continue;
        const back = freshYeastFor({ totalHours: hours, roomTempC: 21, coldHours, coldTempC: 4 });
        expect(within(back, dose, 0.005), `${coldHours} h cold / ${dose}%`).toBe(true);
      }
    }
  });

  it('works the same for fresh and dry yeast: only the weight changes', () => {
    const fresh = 0.3;
    for (const form of ['fresh', 'active_dry', 'instant'] as const) {
      const inForm = freshToForm(fresh, form);
      expect(formToFresh(inForm, form)).toBeCloseTo(fresh, 10);
      expect(hoursForFreshYeast(formToFresh(inForm, form), { roomTempC: 22 })).toBeCloseTo(
        hoursForFreshYeast(fresh, { roomTempC: 22 }),
        6,
      );
    }
    expect(freshToForm(1, 'instant')).toBeCloseTo(0.33, 6);
    expect(freshToForm(1, 'active_dry')).toBeCloseTo(0.4, 6);
  });
});

describe('the short-schedule surcharge', () => {
  it('fades with time and never runs away', () => {
    let previous = Infinity;
    for (const hours of [0, 1, 2, 3, 4, 6, 8, 12]) {
      const factor = shortFermentFactor(hours);
      expect(factor).toBeLessThan(previous);
      expect(factor).toBeGreaterThanOrEqual(1);
      previous = factor;
    }
    expect(shortFermentFactor(0)).toBeLessThan(6);
    expect(shortFermentFactor(12)).toBeLessThan(1.02);
  });

  it('applies only to the part of the dough a ripe preferment has not already developed', () => {
    expect(shortFermentFactor(3, 0.5)).toBeLessThan(shortFermentFactor(3));
    expect(shortFermentFactor(3, 1)).toBe(1);
  });
});

describe('preferments', () => {
  it('follows the poolish rule: 0.1% for 12–15 h, about 1.5% for 3 h', () => {
    const long = prefermentYeastFor('poolish', { hours: 13.5, tempC: 21 });
    const short = prefermentYeastFor('poolish', { hours: 3, tempC: 21 });
    expect(long).toBeGreaterThan(0.07);
    expect(long).toBeLessThan(0.15);
    expect(short).toBeGreaterThan(1);
    expect(short).toBeLessThan(2);
  });

  it("follows Giorilli's biga: 1% for 18 h at 18 °C", () => {
    expect(within(prefermentYeastFor('biga', { hours: 18, tempC: 18 }), 1, 0.05)).toBe(true);
  });

  it('asks for more yeast for a shorter, colder or fridge-bound build', () => {
    const base = prefermentYeastFor('poolish', { hours: 16, tempC: 20 });
    expect(prefermentYeastFor('poolish', { hours: 10, tempC: 20 })).toBeGreaterThan(base);
    expect(prefermentYeastFor('poolish', { hours: 16, tempC: 16 })).toBeGreaterThan(base);
    expect(prefermentYeastFor('poolish', { hours: 16, tempC: 20, coldHours: 12 })).toBeGreaterThan(base);
  });

  it('carries at least the ripe floor into the dough, or everything it was given', () => {
    expect(prefermentLeavening(0.35, 0.15)).toBeCloseTo(0.35 * RIPE_PREFERMENT_POTENCY_PCT, 10);
    expect(prefermentLeavening(0.35, 1.8)).toBeCloseTo(0.35 * 1.8, 10);
    expect(prefermentLeavening(0, 1)).toBe(0);
  });

  it('reports an impossible build honestly rather than inventing a dose', () => {
    // An hour in the fridge cannot ripen a poolish; the raw clock says so by
    // asking for more than any practical dose, and the engine clamps and warns.
    expect(prefermentYeastFor('poolish', { hours: 1, tempC: 4 })).toBeGreaterThan(FRESH_YEAST_MAX_PCT);
  });
});
