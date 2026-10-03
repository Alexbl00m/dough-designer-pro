/**
 * Regression tests from two recipes a baker exported on 2–3 October 2026, the
 * bug report that rebuilt the yeast and the plan:
 *
 *  A: /calculator?s=pizza_poolish&bc=6&h=68&t=3&dt=20&m=dlx
 *  B: /calculator?s=pizza_poolish&bc=6&h=68&su=0.5&rt=20
 *
 * What was wrong: both put the same 4.91 g of instant yeast in the final dough
 * whatever the time (the dose sat at a ceiling), the poolish was fixed at 16 h
 * at 18 °C and not counted in the total, honey went in twice, and the timeline
 * started at "now" so the bake landed at four in the morning.
 */

import { describe, expect, it } from 'vitest';
import { getStyleById } from '@/data/styles';
import { calculateRecipe } from '@/core/calculations';
import type { CalculationInputs, CalculationResults } from '@/core/types';
import { queryToParams } from '@/lib/recipe/state';

const LINK_A = 's=pizza_poolish&bc=6&h=68&t=3&dt=20&m=dlx';
const LINK_B = 's=pizza_poolish&bc=6&h=68&su=0.5&rt=20';

const now = new Date(2026, 9, 3, 9, 0);
const sundayDinner = new Date(2026, 9, 4, 18, 0);

/** The inputs the calculator page builds from a link. */
function fromLink(query: string, overrides: Partial<CalculationInputs> = {}): CalculationInputs {
  const p = queryToParams(query)!;
  return {
    style: getStyleById(p.styleId)!,
    scaleMode: p.scaleMode,
    ballWeight: p.ballWeight,
    ballCount: p.ballCount,
    driver: p.driver,
    totalTime: p.totalTime,
    leavenPct: p.leavenPct,
    roomTemp: p.roomTemp,
    coldTemp: p.coldTemp,
    coldHours: p.coldHours,
    coldPhase: p.coldPhase,
    hydration: p.hydration,
    salt: p.salt,
    sugar: p.sugar,
    oil: p.oil,
    leavenType: p.leavenType,
    yeastForm: p.yeastForm,
    mixing: p.mixing,
    desiredDoughTemp: p.doughTemp,
    starterHydration: p.starterHydration,
    usePreferment: p.usePreferment,
    prefermentHours: p.prefermentHours || undefined,
    prefermentTemp: p.prefermentTemp ?? undefined,
    prefermentColdHours: p.prefermentColdHours,
    percentBasis: p.percentBasis,
    plan: { mode: 'ready', at: sundayDinner },
    now,
    ...overrides,
  };
}

const grams = (r: CalculationResults, section: 'preferment' | 'final', type: string) =>
  r.sections
    .find((s) => s.id === section)!
    .ingredients.filter((i) => i.type === type)
    .reduce((sum, i) => sum + i.grams, 0);

describe('the yeast follows the time', () => {
  it('lowers the final-dough yeast with every extra hour, instead of sitting at a ceiling', () => {
    let previous = Infinity;
    for (const totalTime of [3, 4, 6, 8, 12]) {
      const r = calculateRecipe(fromLink(LINK_A, { totalTime }));
      const yeast = grams(r, 'final', 'yeast');
      expect(yeast, `${totalTime} h`).toBeLessThan(previous);
      previous = yeast;
      if (yeast === 0) break;
    }
  });

  it('no longer puts 4.91 g of instant yeast on top of a ripe poolish for a six-hour dough', () => {
    const r = calculateRecipe(fromLink(LINK_B));
    expect(grams(r, 'final', 'yeast')).toBeLessThan(1);
    expect(r.notes.some((n) => n.code === 'note.yeast_clamped')).toBe(false);
  });

  it('gives the poolish the yeast that ripens it on its own schedule', () => {
    const r = calculateRecipe(fromLink(LINK_B));
    const poolishYeast = grams(r, 'preferment', 'yeast');
    expect(poolishYeast).toBeGreaterThan(0.5);
    expect(poolishYeast).toBeLessThan(1.5);

    // A warm 16 h poolish needs far less than one that spends the night in the fridge.
    const warm = calculateRecipe(fromLink(LINK_B, { prefermentHours: 16, prefermentColdHours: 0, prefermentTemp: 18 }));
    expect(warm.preferment!.freshYeastPct).toBeLessThan(r.preferment!.freshYeastPct);
  });

  it('counts what the ripe poolish carries, so the final dough gets only the rest', () => {
    const r = calculateRecipe(fromLink(LINK_B));
    expect(r.fermentation.prefermentLeaveningPct).toBeGreaterThan(0);
    const straight = calculateRecipe(fromLink(LINK_B, { usePreferment: false }));
    expect(r.fermentation.yeastPct).toBeLessThan(straight.fermentation.yeastPct);
  });

  it('says so when the poolish alone would have the dough ready early', () => {
    const r = calculateRecipe(fromLink(LINK_B, { totalTime: 10 }));
    expect(r.fermentation.yeastPct).toBe(0);
    expect(r.notes.some((n) => n.code === 'note.preferment_strong')).toBe(true);
    expect(r.fermentation.prefermentReadyHours).toBeLessThan(10);
  });

  it('warns rather than inventing a dose for a poolish that cannot ripen in time', () => {
    const r = calculateRecipe(fromLink(LINK_B, { prefermentHours: 1, prefermentColdHours: 1 }));
    expect(r.notes.some((n) => n.code === 'note.preferment_too_short')).toBe(true);
  });
});

describe('the plan the baker asked for', () => {
  it('finishes when asked, with the poolish counted in the 24 hours', () => {
    const r = calculateRecipe(fromLink(LINK_B));
    expect(Date.parse(r.readyAt)).toBe(sundayDinner.getTime());
    expect(r.plan.fermentHours).toBeCloseTo(24, 6);
    expect(r.plan.startsInPast).toBe(false);
  });

  it('keeps every hands-on step out of the night for a Sunday dinner', () => {
    for (const link of [LINK_A, LINK_B]) {
      const r = calculateRecipe(fromLink(link));
      expect(r.plan.nightSteps, link).toEqual([]);
    }
  });

  it('lets the baker set the poolish time and fridge hours', () => {
    const r = calculateRecipe(fromLink(LINK_B, { prefermentHours: 22, prefermentColdHours: 20 }));
    expect(r.preferment!.hours).toBe(22);
    expect(r.preferment!.coldHours).toBe(20);
    expect(r.plan.fermentHours).toBeCloseTo(28, 6);
  });
});

describe('the water', () => {
  it('does not change when only the time changes', () => {
    const three = calculateRecipe(fromLink(LINK_B, { totalTime: 3 }));
    const six = calculateRecipe(fromLink(LINK_B, { totalTime: 6 }));
    expect(three.water.tempC).toBe(six.water.tempC);
  });

  it('takes the fridge poolish out an hour before the mix, and counts it at the temperature it has reached', () => {
    const b = calculateRecipe(fromLink(LINK_B));
    const temper = b.timeline.find((s) => s.key === 'process.preferment.temper')!;
    const mix = b.timeline.find((s) => s.phase === 'mix')!;
    expect(temper.handsOn).toBe(true);
    expect((Date.parse(mix.at) - Date.parse(temper.at)) / 60_000).toBe(60);
    // An hour on a 20 °C bench takes a 4 °C poolish to about 12 °C.
    expect(b.preferment!.mixTempC).toBeGreaterThan(10);
    expect(b.preferment!.mixTempC).toBeLessThan(14);
  });

  it('follows the classic rule, with the poolish at the temperature it comes in at', () => {
    // Link A: DDT 20, a 22 °C room and flour, a DLX (4 °C friction), and the
    // poolish after an hour on the bench: 4 × 20 − 22 − 22 − 4 − poolish.
    const a = calculateRecipe(fromLink(LINK_A));
    expect(a.water.factors).toBe(4);
    expect(a.water.rawTempC).toBeCloseTo(80 - 22 - 22 - 4 - a.preferment!.mixTempC, 6);
    expect(a.water.clamped).toBe(false);
  });

  it('never asks for water hotter than 38 °C, and says where the dough lands instead', () => {
    // Link B: DDT 24 in a 20 °C room by hand would take about 42 °C water.
    const b = calculateRecipe(fromLink(LINK_B));
    expect(b.water.rawTempC).toBeGreaterThan(38);
    expect(b.water.tempC).toBe(38);
    expect(b.water.doughTempC).toBeGreaterThan(22);
    expect(b.water.doughTempC).toBeLessThan(24);
    expect(b.notes.some((n) => n.code === 'note.water_too_hot')).toBe(true);
  });

  it('keeps every style below 38 °C water, whatever the kitchen', async () => {
    const { BREAD_STYLES } = await import('@/data/styles');
    for (const style of BREAD_STYLES) {
      for (const roomTemp of [14, 18, 22]) {
        const r = calculateRecipe({
          style,
          ballWeight: style.defaults.ballWeight,
          ballCount: style.defaults.ballCount,
          totalTime: style.defaults.totalTime,
          roomTemp,
          coldHours: style.defaults.coldHours,
          leavenType: style.defaults.leavenType,
          yeastForm: 'instant',
          mixing: 'hand',
          desiredDoughTemp: style.defaults.doughTemp,
          now,
        });
        expect(r.water.tempC, `${style.id} @ ${roomTemp} °C`).toBeLessThanOrEqual(38);
      }
    }
  });
});

describe('the honey', () => {
  it('goes into the poolish, once', () => {
    const r = calculateRecipe(fromLink(LINK_B));
    expect(grams(r, 'final', 'sugar')).toBe(0);
    const honey = grams(r, 'preferment', 'sugar');
    expect(honey / r.totals.flour).toBeCloseTo(0.005, 4);
  });

  it('goes back into the dough when the poolish is switched off', () => {
    const r = calculateRecipe(fromLink(LINK_B, { usePreferment: false }));
    expect(grams(r, 'final', 'sugar') / r.totals.flour).toBeCloseTo(0.005, 4);
  });
});

describe('the batch still adds up', () => {
  it('lands on six 270 g balls', () => {
    for (const link of [LINK_A, LINK_B]) {
      const r = calculateRecipe(fromLink(link));
      expect(r.totals.doughWeight, link).toBeGreaterThan(6 * 270 * 0.995);
      expect(r.totals.doughWeight, link).toBeLessThan(6 * 270 * 1.005);
    }
  });
});
