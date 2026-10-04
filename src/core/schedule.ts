/**
 * Schedule builder.
 *
 * Turns a style's `ProcessSpec` plus the computed bulk/proof times into a
 * timeline of real wall-clock steps. Nothing here is style-specific: the shape
 * of a bake comes from data, so adding a style never means touching this file.
 *
 * Offsets are measured from the moment the dough is mixed (the autolyse, if
 * the style has one, comes just before it). Preferment and levain builds
 * happen before that and carry negative offsets.
 *
 * Where those offsets land on the clock is set by an anchor: the baker can pin
 * the start, the mix, or — the question most bakers are really asking — the
 * moment the bake comes out of the oven. The plan is then laid out backwards
 * from it, preferment included.
 */

import type { BreadStyle } from '@/data/styles';
import { isPizzaStyle } from '@/data/styles';
import type { PlanAnchorMode, TimelinePhase, TimelineStep } from './types';

export interface ScheduleAnchor {
  /**
   * 'start' pins the first step (the preferment or levain build, if any);
   * 'mix' pins the moment the dough is mixed; 'ready' pins the end of the bake.
   */
  mode: PlanAnchorMode;
  at: Date;
}

export interface ScheduleInput {
  style: BreadStyle;
  anchor: ScheduleAnchor;
  bulkHours: number;
  proofHours: number;
  coldHours: number;
  coldPhase: 'bulk' | 'proof';
  roomTempC: number;
  coldTempC: number;
  pieces: number;
  usePreferment: boolean;
  prefermentHours?: number;
  prefermentTempC?: number;
  /** Hours at the end of the preferment build spent in the fridge. */
  prefermentColdHours?: number;
  /** Of those, the last hours on the bench to take the chill off before the mix. */
  prefermentTemperHours?: number;
  prefermentType?: string;
  usesLevain: boolean;
  levainHours: number;
  levainTempC: number;
}

export interface Schedule {
  steps: TimelineStep[];
  /** The first step: preferment or levain build, autolyse, or the mix. */
  startsAt: string;
  mixAt: string;
  /** The bake is finished. */
  readyAt: string;
}

const MIN = 60_000;

const at = (origin: number, offsetMin: number): string =>
  new Date(origin + offsetMin * MIN).toISOString();

/**
 * Phases where the baker has to do something at the step's start. A bulk or a
 * proof starts at the mix or the shaping, which are already counted; the final
 * "done" and the "preferment is ready" marker are not jobs of their own.
 */
const HANDS_ON: ReadonlySet<TimelinePhase> = new Set([
  'preferment',
  'levain',
  'autolyse',
  'mix',
  'fold',
  'divide',
  'shape',
  'cold',
  'bake',
]);
const PASSIVE_KEYS: ReadonlySet<string> = new Set([
  'process.preferment.ready',
  'process.done',
  'process.done.pizza',
]);

export function buildSchedule(input: ScheduleInput): Schedule {
  const { style } = input;
  const p = style.process;
  const steps: Omit<TimelineStep, 'at'>[] = [];

  const push = (
    offsetMin: number,
    durationMin: number,
    phase: TimelinePhase,
    key: string,
    values?: Record<string, string | number>,
    tempC?: number,
  ) => {
    steps.push({
      offsetMin: Math.round(offsetMin),
      durationMin: Math.round(durationMin),
      phase,
      key,
      values,
      tempC,
      handsOn: HANDS_ON.has(phase) && !PASSIVE_KEYS.has(key),
    });
  };

  const autolyseMin = p.autolyseMin ?? 0;

  // ── Preferment and levain, built before the dough is mixed ──
  if (input.usePreferment && input.prefermentHours) {
    const totalMin = input.prefermentHours * 60;
    const coldMin = Math.min(totalMin, Math.max(0, (input.prefermentColdHours ?? 0) * 60));
    const warmMin = totalMin - coldMin;
    const start = -(totalMin + autolyseMin);
    const type = input.prefermentType ?? 'poolish';
    const warmTemp = input.prefermentTempC ?? input.roomTempC;

    // A preferment that spends its night in the fridge is made warm first, so
    // the yeast gets going, and then put away; that is two jobs, not one.
    push(
      start,
      warmMin,
      'preferment',
      coldMin > 0 ? `process.preferment.${type}.cold` : `process.preferment.${type}`,
      { hours: round1(warmMin / 60), temp: warmTemp, coldHours: round1(coldMin / 60) },
      warmTemp,
    );
    const temperMin = Math.min(coldMin, Math.max(0, (input.prefermentTemperHours ?? 0) * 60));
    if (coldMin > 0) {
      push(start + warmMin, coldMin - temperMin, 'cold', 'process.preferment.fridge', {
        hours: round1((coldMin - temperMin) / 60),
        temp: input.coldTempC,
        type,
      }, input.coldTempC);
    }
    if (temperMin > 0) {
      push(-(temperMin + autolyseMin), temperMin, 'preferment', 'process.preferment.temper', {
        minutes: Math.round(temperMin),
        type,
      }, input.roomTempC);
    }
    push(-autolyseMin, 0, 'preferment', 'process.preferment.ready', { type });
  }

  if (input.usesLevain) {
    const offset = -(input.levainHours * 60 + autolyseMin);
    push(offset, input.levainHours * 60, 'levain', 'process.levain.build', {
      hours: input.levainHours,
      temp: input.levainTempC,
    }, input.levainTempC);
  }

  // ── Baking day ──
  let cursor = 0;

  if (autolyseMin > 0) {
    push(-autolyseMin, autolyseMin, 'autolyse', 'process.autolyse', { minutes: autolyseMin });
  }

  push(cursor, p.mixMin, 'mix', 'process.mix', { minutes: p.mixMin });
  cursor += p.mixMin;

  // Cold time is taken out of whichever phase the style retards in, spilling
  // into the other phase if the baker asks for more cold than that phase holds.
  const bulkMin = Math.max(0, input.bulkHours * 60);
  const proofMin = Math.max(0, input.proofHours * 60);
  const coldMin = Math.max(0, input.coldHours * 60);

  let bulkColdMin = 0;
  let proofColdMin = 0;
  if (input.coldPhase === 'bulk') {
    bulkColdMin = Math.min(coldMin, bulkMin);
    proofColdMin = Math.min(coldMin - bulkColdMin, proofMin);
  } else {
    proofColdMin = Math.min(coldMin, proofMin);
    bulkColdMin = Math.min(coldMin - proofColdMin, bulkMin);
  }

  const bulkWarmMin = bulkMin - bulkColdMin;
  const proofWarmMin = proofMin - proofColdMin;

  const bulkStart = cursor;
  // The warm and cold parts of a phase are separate steps. Emitting a full-length
  // "bulk" alongside a full-length "bulk in the fridge" would double-count a
  // ferment that is entirely cold.
  if (bulkWarmMin > 0) {
    const [riseMin, riseMax] = style.bulkRisePct ?? [50, 60];
    push(bulkStart, bulkWarmMin, 'bulk', 'process.bulk', {
      hours: round1(bulkWarmMin / 60),
      temp: input.roomTempC,
      riseMin,
      riseMax,
    }, input.roomTempC);
  }

  // Folds live in the warm part of the bulk only — dough in the fridge is
  // too stiff and too slow for folding to do anything useful.
  if (p.folds && bulkWarmMin > 0) {
    const first = p.benchRestMin ?? p.folds.intervalMin;
    for (let i = 0; i < p.folds.count; i += 1) {
      const offset = bulkStart + first + i * p.folds.intervalMin;
      if (offset >= bulkStart + bulkWarmMin) break;
      push(offset, 0, 'fold', 'process.fold', {
        index: i + 1,
        count: p.folds.count,
        technique: p.folds.techniqueKey,
      });
    }
  }

  if (bulkColdMin > 0) {
    push(bulkStart + bulkWarmMin, bulkColdMin, 'cold', 'process.cold.bulk', {
      hours: round1(bulkColdMin / 60),
      temp: input.coldTempC,
    }, input.coldTempC);
  }

  cursor = bulkStart + bulkMin;

  // ── Divide, pre-shape, shape ──
  if (input.pieces > 1) {
    push(cursor, 0, 'divide', 'process.divide', { pieces: input.pieces });
  }

  if (p.preshapeRestMin) {
    push(cursor, p.preshapeRestMin, 'divide', 'process.preshape', {
      minutes: p.preshapeRestMin,
    });
    cursor += p.preshapeRestMin;
  }

  push(cursor, 0, 'shape', p.shapeKey, { pieces: input.pieces });

  // ── Final proof ──
  const proofStart = cursor;
  if (proofWarmMin > 0) {
    push(proofStart, proofWarmMin, 'proof', 'process.proof', {
      hours: round1(proofWarmMin / 60),
      temp: input.roomTempC,
    }, input.roomTempC);
  }

  if (proofColdMin > 0) {
    push(proofStart + proofWarmMin, proofColdMin, 'cold', 'process.cold.proof', {
      hours: round1(proofColdMin / 60),
      temp: input.coldTempC,
    }, input.coldTempC);
  }

  cursor = proofStart + proofMin;

  // ── Bake ──
  // The oven has to be told before the dough is ready, not at the same moment:
  // a stone or Dutch oven needs a long soak to hold its heat through the bake.
  const preheatMin = p.bakeTempC >= 400 ? 60 : p.steamMinutes ? 45 : 30;
  push(Math.max(bulkStart, cursor - preheatMin), preheatMin, 'bake', 'process.preheat', {
    temp: p.bakeTempC,
    minutes: preheatMin,
  });
  push(cursor, p.bakeMinutes, 'bake', p.bakeKey, {
    temp: p.bakeTempC,
    dropTemp: p.bakeDropTempC ?? p.bakeTempC,
    minutes: p.bakeMinutes,
    steam: p.steamMinutes ?? 0,
    pieces: input.pieces,
  }, p.bakeTempC);

  cursor += p.bakeMinutes;
  const readyOffset = cursor;
  push(cursor, 0, 'done', isPizzaStyle(style) ? 'process.done.pizza' : 'process.done', {
    minutes: coolingMinutes(style),
  });

  steps.sort((a, b) => a.offsetMin - b.offsetMin);

  // ── Pin it to the clock ──
  const firstOffset = steps.length ? steps[0].offsetMin : 0;
  const anchorMs = input.anchor.at.getTime();
  const origin =
    input.anchor.mode === 'ready'
      ? anchorMs - readyOffset * MIN
      : input.anchor.mode === 'start'
        ? anchorMs - firstOffset * MIN
        : anchorMs;

  return {
    steps: steps.map((s) => ({ ...s, at: at(origin, s.offsetMin) })),
    startsAt: at(origin, firstOffset),
    mixAt: at(origin, 0),
    readyAt: at(origin, readyOffset),
  };
}

/** Lean loaves need a full cool before cutting; flatbreads and pizza do not. */
function coolingMinutes(style: BreadStyle): number {
  if (isPizzaStyle(style)) return 2;
  if (style.category === 'enriched') return 45;
  return 60;
}

// ── Living with the plan ───────────────────────────────────────────────────

/** Nobody wants to fold dough between eleven at night and six in the morning. */
export const NIGHT = { fromHour: 23, toHour: 6 } as const;

/** Whether a moment falls in the night, in the baker's own time zone. */
export function isNight(iso: string): boolean {
  const d = new Date(iso);
  const hour = d.getHours() + d.getMinutes() / 60;
  return hour >= NIGHT.fromHour || hour < NIGHT.toHour;
}

/** Indices of the steps that need hands at night. */
export function nightStepIndices(steps: TimelineStep[]): number[] {
  return steps.flatMap((s, i) => (s.handsOn && isNight(s.at) ? [i] : []));
}

/**
 * The smallest shift, in minutes, that moves every hands-on step out of the
 * night without starting before `notBefore`. Searches a day either way in
 * quarter hours, preferring the nearer and, on a tie, the later. Returns null
 * when the plan has no night work or no shift clears it.
 */
export function daytimeShiftMinutes(
  steps: TimelineStep[],
  notBefore?: Date,
): number | null {
  const handsOn = steps.filter((s) => s.handsOn).map((s) => new Date(s.at).getTime());
  if (!handsOn.length) return null;
  const clear = (shift: number) =>
    handsOn.every((t) => !isNight(new Date(t + shift * MIN).toISOString()));
  if (clear(0)) return null;

  const first = new Date(steps[0].at).getTime();
  const allowed = (shift: number) =>
    !notBefore || first + shift * MIN >= notBefore.getTime();

  for (let k = 1; k <= 96; k += 1) {
    for (const shift of [k * 15, -k * 15]) {
      if (allowed(shift) && clear(shift)) return shift;
    }
  }
  return null;
}

/** The next quarter hour at or after `date`. Bakers think in quarters, not in 14:37. */
export function ceilToQuarter(date: Date): Date {
  const d = new Date(date);
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
  if (d.getTime() < date.getTime()) d.setMinutes(d.getMinutes() + 15);
  return d;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** The first moment at or after `after` when the clock reads `hour`:`minute`. */
export function nextClockTime(after: Date, hour: number, minute = 0): Date {
  const d = new Date(after);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() < after.getTime()) d.setDate(d.getDate() + 1);
  return d;
}
