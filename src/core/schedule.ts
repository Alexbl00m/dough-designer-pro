/**
 * Schedule builder.
 *
 * Turns a style's `ProcessSpec` plus the computed bulk/proof times into a
 * timeline of real wall-clock steps. Nothing here is style-specific: the shape
 * of a bake comes from data, so adding a style never means touching this file.
 *
 * Time zero is the moment the baker starts working on baking day (the mix, or
 * the autolyse if the style has one). Preferment and levain builds happen
 * before that and carry negative offsets.
 */

import type { BreadStyle } from '@/data/styles';
import type { TimelinePhase, TimelineStep } from './types';

export interface ScheduleInput {
  style: BreadStyle;
  startTime: Date;
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
  prefermentType?: string;
  usesLevain: boolean;
  levainHours: number;
  levainTempC: number;
}

const MIN = 60_000;

const at = (start: Date, offsetMin: number): string =>
  new Date(start.getTime() + offsetMin * MIN).toISOString();

export function buildSchedule(input: ScheduleInput): {
  steps: TimelineStep[];
  readyAt: string;
} {
  const { style, startTime } = input;
  const p = style.process;
  const steps: TimelineStep[] = [];

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
      at: at(startTime, offsetMin),
      durationMin: Math.round(durationMin),
      phase,
      key,
      values,
      tempC,
    });
  };

  const autolyseMin = p.autolyseMin ?? 0;

  // ── Preferment and levain, built before baking day starts ──
  if (input.usePreferment && input.prefermentHours) {
    const offset = -(input.prefermentHours * 60 + autolyseMin);
    push(offset, input.prefermentHours * 60, 'preferment', `process.preferment.${input.prefermentType}`, {
      hours: input.prefermentHours,
      temp: input.prefermentTempC ?? input.roomTempC,
    }, input.prefermentTempC);
    push(-autolyseMin, 0, 'preferment', 'process.preferment.ready', {
      type: input.prefermentType ?? 'poolish',
    });
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
  push(cursor, 0, 'done', 'process.done', { minutes: coolingMinutes(style) });

  steps.sort((a, b) => a.offsetMin - b.offsetMin);
  return { steps, readyAt: at(startTime, cursor) };
}

/** Lean loaves need a full cool before cutting; flatbreads and pizza do not. */
function coolingMinutes(style: BreadStyle): number {
  if (style.category === 'pizza') return 2;
  if (style.category === 'enriched') return 45;
  return 60;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
