import { describe, expect, it } from 'vitest';
import { BREAD_STYLES, getStyleById } from '@/data/styles';
import { calculateRecipe } from '@/core/calculations';
import type { CalculationInputs } from '@/core/types';

const START = new Date('2026-03-14T09:00:00Z');

const build = (overrides: Partial<CalculationInputs> = {}) => {
  const style = overrides.style ?? getStyleById('country_sourdough')!;
  return calculateRecipe({
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
  });
};

const minutesOf = (steps: { key: string; durationMin: number }[], key: string) =>
  steps.filter((s) => s.key === key).reduce((sum, s) => sum + s.durationMin, 0);

describe('schedule — phase durations', () => {
  it('never counts a phase twice when the whole of it is cold', () => {
    // 8 h total on a style whose proof ratio takes less than the 8 h of cold,
    // so the cold spills and the proof is entirely in the fridge.
    const r = build({ totalTime: 8, coldHours: 8, coldPhase: 'proof' });
    const warm = minutesOf(r.timeline, 'process.proof') + minutesOf(r.timeline, 'process.bulk');
    const cold =
      minutesOf(r.timeline, 'process.cold.proof') + minutesOf(r.timeline, 'process.cold.bulk');
    expect(warm).toBe(0);
    expect(cold / 60).toBeCloseTo(8, 1);
  });

  it('splits a partly-cold phase into a warm step and a cold step', () => {
    const r = build({ totalTime: 12, coldHours: 4, coldPhase: 'proof' });
    const proofWarm = minutesOf(r.timeline, 'process.proof');
    const proofCold = minutesOf(r.timeline, 'process.cold.proof');
    expect(proofWarm).toBeGreaterThan(0);
    expect(proofCold).toBeGreaterThan(0);
    expect((proofWarm + proofCold) / 60).toBeCloseTo(r.fermentation.proofHours, 1);
  });

  it('accounts for the whole ferment across warm and cold steps, for every style', () => {
    for (const style of BREAD_STYLES) {
      const r = build({ style });
      const accounted =
        minutesOf(r.timeline, 'process.bulk') +
        minutesOf(r.timeline, 'process.cold.bulk') +
        minutesOf(r.timeline, 'process.proof') +
        minutesOf(r.timeline, 'process.cold.proof');
      expect(accounted / 60, `${style.id}`).toBeCloseTo(r.fermentation.totalHours, 1);
    }
  });
});

describe('schedule — oven', () => {
  it('starts the preheat before the bake, never at the same moment', () => {
    for (const style of BREAD_STYLES) {
      const r = build({ style });
      const preheat = r.timeline.find((s) => s.key === 'process.preheat')!;
      const bake = r.timeline.find((s) => s.key === style.process.bakeKey)!;
      expect(preheat.offsetMin, `${style.id}`).toBeLessThan(bake.offsetMin);
    }
  });

  it('gives a very hot oven a longer soak than a moderate one', () => {
    const pizza = build({ style: getStyleById('neapolitan')! });
    const loaf = build({ style: getStyleById('pain_de_mie')! });
    const soak = (r: typeof pizza) =>
      r.timeline.find((s) => s.key === 'process.preheat')!.durationMin;
    expect(soak(pizza)).toBeGreaterThan(soak(loaf));
  });

  it('finishes with a rest before slicing', () => {
    const r = build();
    expect(r.timeline.at(-1)!.key).toBe('process.done');
  });
});

describe('schedule — folds', () => {
  it('never schedules a fold once the dough is in the fridge', () => {
    const r = build({ totalTime: 12, coldHours: 9, coldPhase: 'bulk' });
    const cold = r.timeline.find((s) => s.key === 'process.cold.bulk');
    if (!cold) return;
    for (const fold of r.timeline.filter((s) => s.phase === 'fold')) {
      expect(fold.offsetMin).toBeLessThanOrEqual(cold.offsetMin);
    }
  });

  it('schedules folds only for styles that declare them', () => {
    const withFolds = build({ style: getStyleById('country_sourdough')! });
    const without = build({ style: getStyleById('milkbread')! });
    expect(withFolds.timeline.some((s) => s.phase === 'fold')).toBe(true);
    expect(without.timeline.some((s) => s.phase === 'fold')).toBe(false);
  });
});
