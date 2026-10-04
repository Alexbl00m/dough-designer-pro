/**
 * Pinning the plan to the clock: "ready by six" is laid out backwards, the
 * preferment included; a plan that would have to start in the past says so;
 * and steps that need hands in the middle of the night are flagged with a fix.
 *
 * Dates are built in local time, because "night" is the baker's own night.
 */

import { describe, expect, it } from 'vitest';
import { getStyleById } from '@/data/styles';
import { calculateRecipe } from '@/core/calculations';
import { ceilToQuarter, daytimeShiftMinutes, isNight, nextClockTime } from '@/core/schedule';
import type { CalculationInputs } from '@/core/types';
import { DEFAULT_READY_HOUR, calculateWithPlan, resolvePlanAnchor } from '@/lib/recipe/plan';

const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);

const poolish = (overrides: Partial<CalculationInputs> = {}): CalculationInputs => {
  const style = getStyleById('pizza_poolish')!;
  return {
    style,
    ballWeight: 270,
    ballCount: 6,
    totalTime: style.defaults.totalTime,
    roomTemp: style.defaults.roomTemp,
    coldHours: 0,
    leavenType: 'commercial',
    yeastForm: 'instant',
    mixing: 'hand',
    desiredDoughTemp: style.defaults.doughTemp,
    ...overrides,
  };
};

const minutesBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60_000;

describe('a plan worked back from "ready by"', () => {
  const ready = local(4, 18);
  const r = calculateRecipe(poolish({ plan: { mode: 'ready', at: ready }, now: local(3, 9) }));

  it('finishes the bake exactly when asked', () => {
    expect(Date.parse(r.readyAt)).toBe(ready.getTime());
    expect(r.plan.readyAt).toBe(r.readyAt);
  });

  it('starts with the preferment, early enough for it to ripen before the mix', () => {
    const first = r.timeline[0];
    expect(first.phase).toBe('preferment');
    expect(first.at).toBe(r.plan.startsAt);
    const mix = r.timeline.find((s) => s.phase === 'mix')!;
    expect(minutesBetween(first.at, mix.at) / 60).toBeCloseTo(r.preferment!.hours, 1);
  });

  it('adds up to the whole fermentation the baker thinks in: preferment plus dough', () => {
    expect(r.plan.fermentHours).toBeCloseTo(r.preferment!.hours + r.fermentation.totalHours, 6);
    // The default pizza with poolish is the classic 24 h: 18 h poolish, 6 h dough.
    expect(r.plan.fermentHours).toBeCloseTo(24, 6);
  });

  it('keeps every step in order and in time', () => {
    const times = r.timeline.map((s) => Date.parse(s.at));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(r.plan.startsInPast).toBe(false);
  });

  it('puts an overnight poolish in the fridge, and takes it out an hour before the mix', () => {
    const fridge = r.timeline.find((s) => s.key === 'process.preferment.fridge')!;
    const temper = r.timeline.find((s) => s.key === 'process.preferment.temper')!;
    expect(fridge.handsOn).toBe(true);
    expect(temper.handsOn).toBe(true);
    expect(temper.durationMin).toBe(60);
    expect((fridge.durationMin + temper.durationMin) / 60).toBeCloseTo(r.preferment!.coldHours, 1);
  });
});

describe('a plan pinned to its start', () => {
  it('starts the first step at the chosen moment', () => {
    const start = local(3, 17, 45);
    const r = calculateRecipe(poolish({ plan: { mode: 'start', at: start } }));
    expect(Date.parse(r.plan.startsAt)).toBe(start.getTime());
    expect(Date.parse(r.timeline[0].at)).toBe(start.getTime());
  });

  it('still mixes at `startTime` for callers that only pass that', () => {
    const mix = local(3, 12);
    const r = calculateRecipe(poolish({ startTime: mix }));
    expect(Date.parse(r.plan.mixAt)).toBe(mix.getTime());
    expect(Date.parse(r.timeline.find((s) => s.phase === 'mix')!.at)).toBe(mix.getTime());
  });
});

describe('never in the past', () => {
  it('flags a ready-by plan that would have had to start before now, with the soonest finish', () => {
    const now = local(4, 12);
    const r = calculateRecipe(poolish({ plan: { mode: 'ready', at: local(4, 18) }, now }));
    expect(r.plan.startsInPast).toBe(true);
    const earliest = Date.parse(r.plan.earliestReadyAt);
    const span = Date.parse(r.readyAt) - Date.parse(r.plan.startsAt);
    expect(earliest).toBe(ceilToQuarter(now).getTime() + span);
    expect(earliest).toBeGreaterThan(Date.parse(r.readyAt));
  });

  it('suggests, by default, the first six o’clock the recipe can still make', () => {
    const now = local(3, 9, 7);
    const inputs = poolish();
    const anchor = resolvePlanAnchor(inputs, { mode: 'ready', at: null }, now);
    expect(anchor.getHours()).toBe(DEFAULT_READY_HOUR);
    expect(anchor.getMinutes()).toBe(0);

    const r = calculateWithPlan(inputs, { mode: 'ready', at: null }, now);
    expect(r.plan.startsInPast).toBe(false);
    expect(Date.parse(r.plan.startsAt)).toBeGreaterThanOrEqual(now.getTime());
    // And not a day later than it has to be.
    expect(Date.parse(r.readyAt) - Date.parse(r.plan.earliestReadyAt)).toBeLessThan(86_400_000);
  });

  it('starts a start-now plan at the next quarter hour', () => {
    const now = local(3, 9, 7);
    const anchor = resolvePlanAnchor(poolish(), { mode: 'start', at: null }, now);
    expect(anchor.getTime()).toBe(local(3, 9, 15).getTime());
  });

  it('respects a time the baker picked over the suggestion', () => {
    const picked = local(10, 19, 30);
    expect(resolvePlanAnchor(poolish(), { mode: 'ready', at: picked }, local(3, 9))).toBe(picked);
  });
});

describe('the night', () => {
  it('knows when night is', () => {
    expect(isNight(local(3, 23, 30).toISOString())).toBe(true);
    expect(isNight(local(4, 2).toISOString())).toBe(true);
    expect(isNight(local(4, 5, 59).toISOString())).toBe(true);
    expect(isNight(local(4, 6).toISOString())).toBe(false);
    expect(isNight(local(4, 22, 59).toISOString())).toBe(false);
  });

  it('flags hands-on steps at night and finds the nearest plan without them', () => {
    // Ready at 05:00 puts the mixing, folding and balling in the small hours.
    const r = calculateRecipe(poolish({ plan: { mode: 'ready', at: local(5, 5) }, now: local(3, 9) }));
    expect(r.plan.nightSteps.length).toBeGreaterThan(0);
    for (const i of r.plan.nightSteps) expect(r.timeline[i].handsOn).toBe(true);

    expect(r.plan.daytimeShiftMin).not.toBeNull();
    const shifted = calculateRecipe(
      poolish({
        plan: { mode: 'ready', at: new Date(local(5, 5).getTime() + r.plan.daytimeShiftMin! * 60_000) },
        now: local(3, 9),
      }),
    );
    expect(shifted.plan.nightSteps).toEqual([]);
  });

  it('does not count a dough rising or a bake finishing as work', () => {
    const r = calculateRecipe(poolish({ plan: { mode: 'ready', at: local(5, 0, 30) }, now: local(3, 9) }));
    const done = r.timeline.at(-1)!;
    expect(done.handsOn).toBe(false);
    expect(r.timeline.filter((s) => s.phase === 'bulk' || s.phase === 'proof').every((s) => !s.handsOn)).toBe(
      true,
    );
  });

  it('never suggests a shift that would start before it is allowed to', () => {
    const r = calculateRecipe(poolish({ plan: { mode: 'ready', at: local(5, 5) }, now: local(3, 9) }));
    const notBefore = new Date(Date.parse(r.plan.startsAt) + 60_000);
    const shift = daytimeShiftMinutes(r.timeline, notBefore);
    if (shift !== null) expect(shift).toBeGreaterThan(0);
  });

  it('finds the next six o’clock, today or tomorrow', () => {
    expect(nextClockTime(local(3, 9), 18).getTime()).toBe(local(3, 18).getTime());
    expect(nextClockTime(local(3, 19), 18).getTime()).toBe(local(4, 18).getTime());
  });
});
