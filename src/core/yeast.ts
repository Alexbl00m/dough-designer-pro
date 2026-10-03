/**
 * The commercial-yeast clock.
 *
 * Commercial yeast does not run on the sourdough table. A levain is a mixed
 * culture whose bulk ends when it has built a structure and a final proof
 * follows; a pinch of instant yeast in a pizza dough is a single organism that
 * is dosed for the whole schedule, mix to bake. Putting yeast on the sourdough
 * curve is what pinned short doughs at a ceiling and long ones at a floor, so
 * yeast has its own clock here.
 *
 * The clock is TXCraig1's yeast-prediction model from pizzamaking.com, the
 * reference most pizza calculators are built on:
 *
 *  - Temperature follows the Gänzle et al. (1998) growth-rate model,
 *        μ(T) = a · x^b · e^(c·x),  x = 45 − T,
 *    with Craig's fitted parameters. It is steep in the cold and flattens near
 *    the optimum at about 35 °C, which is why a fridge slows a dough by roughly
 *    ten times rather than the four a constant Q10 of 2 would predict.
 *  - Dose follows a power law in temperature-adjusted hours,
 *        yeast% = anchor · (hours / 12)^−1.6,
 *    anchored on 0.048% instant yeast being ready in 12 h at 70 °F (21.1 °C).
 *    The exponent reproduces Craig's chart for the fridge: about 0.64% for 24 h
 *    and 0.2% for 48 h at 39–40 °F.
 *
 * Two corrections sit on top. Salt, sugar, water and fat stretch the clock
 * exactly as they do for sourdough (`timeCorrection`), measured against the
 * dough Craig's chart describes. And a very short schedule needs more yeast
 * than the power law alone suggests: a dough needs a few hours to develop and
 * proof however much yeast it carries, which is why a 3 h straight dough is
 * made with around 2% fresh yeast rather than the 0.7% the curve would give.
 *
 * Every function here is monotone: more yeast is always less time, warmer is
 * always less time, and the inverse is the same equation solved the other way.
 *
 * Sources:
 *  - TXCraig1, "Baker's yeast quantity prediction model" (pizzamaking.com,
 *    topic 26831) and its worked examples (topic 79284).
 *  - Gänzle, Ehmann & Hammes (1998), Appl. Environ. Microbiol. 64:2616–2623.
 *  - The poolish rule of thumb (Weekend Bakery, BAKERpedia): about 1.5% yeast
 *    for 3 h, 0.7% for 6–8 h, 0.1% for 12–15 h at room temperature.
 *  - Biga after Giorilli: 1% fresh yeast, 44% water, about 18 h at 18 °C.
 */

import {
  DEFAULT_COLD_TEMP_C,
  FRIDGE_COOLDOWN_HOURS,
  YEAST_CONVERSION,
  clamp,
} from './constants';
import type { YeastForm } from './constants';
import { timeCorrection } from './growth';

// ── Temperature ────────────────────────────────────────────────────────────

/** Gänzle's growth-rate model with TXCraig1's fitted parameters. */
export const GANZLE = {
  a: 0.02645608,
  b: 2.037020784,
  c: -0.198964236,
  maxTempC: 45,
} as const;

/**
 * Where the growth rate peaks, ≈ 34.8 °C. Past it yeast starts to suffer, but a
 * slider that made a warmer room *slower* would be a trap, so the clock holds
 * its fastest rate from here up.
 */
export const YEAST_OPTIMUM_C = GANZLE.maxTempC + GANZLE.b / GANZLE.c;

/** Relative yeast activity at `tempC`, per hour. Only ratios of it mean anything. */
export function yeastRate(tempC: number): number {
  const t = clamp(tempC, -2, YEAST_OPTIMUM_C);
  const x = GANZLE.maxTempC - t;
  return GANZLE.a * x ** GANZLE.b * Math.exp(GANZLE.c * x);
}

/** How many times faster yeast works at `tempC` than at `referenceC`. */
export const yeastRateRatio = (tempC: number, referenceC: number): number =>
  yeastRate(tempC) / yeastRate(referenceC);

// ── The anchor ─────────────────────────────────────────────────────────────

/**
 * TXCraig1's anchor: 0.048% instant yeast is ready in 12 h at 70 °F. The chart
 * is stated for 60% hydration; the salt is a Neapolitan 2.8%, which is the kind
 * of dough the model was built from.
 */
export const YEAST_ANCHOR = {
  instantPct: 0.048,
  hours: 12,
  tempC: 21.1,
  hydrationPct: 60,
  saltPct: 2.8,
} as const;

/** The anchor dose in fresh yeast, the unit the engine works in. */
export const YEAST_ANCHOR_FRESH_PCT = YEAST_ANCHOR.instantPct / YEAST_CONVERSION.instant;

/** yeast% ∝ hours^−1.6 — doubling the yeast takes a third off the time, not half. */
export const YEAST_TIME_EXPONENT = 1.6;

/**
 * A dough needs time to develop and proof however much yeast it carries. This
 * surcharge on the dose fades over the first few hours of the schedule:
 * ×3.5 at 2 h, ×2 at 3 h, ×1.2 at 6 h, nothing worth weighing past 10 h.
 *
 * Calibrated on straight-dough practice — about 2% fresh yeast for a 2½–3 h
 * dough at 25 °C, about 1% for a 4 h pizza dough — which the bare power law
 * would put at a third of that.
 */
export const SHORT_FERMENT = { amplitude: 4.5, hours: 2 } as const;

/** Practical limits for commercial yeast, as fresh yeast on total flour. */
export const FRESH_YEAST_MIN_PCT = 0.003;
export const FRESH_YEAST_MAX_PCT = 8;

// ── Schedules → anchor hours ───────────────────────────────────────────────

export interface YeastSchedule {
  /** Hours from mix to bake, cold time included. */
  totalHours: number;
  roomTempC: number;
  /** Hours of the total spent in the fridge. */
  coldHours?: number;
  coldTempC?: number;
}

/**
 * How many hours at the anchor temperature (21.1 °C) a schedule is worth.
 *
 * The fridge is counted the way the rest of the engine counts it: the first
 * `FRIDGE_COOLDOWN_HOURS` at the midpoint between room and fridge, because a
 * tub of dough takes that long to come down and ferments briskly on the way.
 */
export function yeastAnchorHours(s: YeastSchedule): number {
  const total = Math.max(0, s.totalHours);
  const cold = clamp(s.coldHours ?? 0, 0, total);
  const warm = total - cold;
  const coldTemp = s.coldTempC ?? DEFAULT_COLD_TEMP_C;

  const lag = Math.min(cold, FRIDGE_COOLDOWN_HOURS);
  const settled = cold - lag;
  const ratio = (t: number) => yeastRateRatio(t, YEAST_ANCHOR.tempC);

  return (
    warm * ratio(s.roomTempC) +
    lag * ratio((s.roomTempC + coldTemp) / 2) +
    settled * ratio(coldTemp)
  );
}

/** The same schedule expressed in hours at the baker's own room temperature. */
export function yeastRoomEquivHours(s: YeastSchedule): number {
  return Math.max(0.25, yeastAnchorHours(s) / yeastRateRatio(s.roomTempC, YEAST_ANCHOR.tempC));
}

// ── The dough clock ────────────────────────────────────────────────────────

export interface YeastRecipe {
  saltPct?: number;
  sugarPct?: number;
  hydrationPct?: number;
  fatPct?: number;
  /**
   * Share of the total flour that arrives already fermented in a ripe
   * preferment, 0–1. That part of the dough has developed already, so the
   * short-schedule surcharge only applies to the rest.
   */
  prefermentShare?: number;
}

/** How much slower this recipe runs than the dough Craig's chart describes. */
export function yeastRecipeCorrection(r: YeastRecipe): number {
  const recipe = timeCorrection({
    saltPct: r.saltPct ?? YEAST_ANCHOR.saltPct,
    sugarPct: r.sugarPct ?? 0,
    hydrationPct: r.hydrationPct ?? YEAST_ANCHOR.hydrationPct,
    fatPct: r.fatPct ?? 0,
  });
  const anchor = timeCorrection({
    saltPct: YEAST_ANCHOR.saltPct,
    sugarPct: 0,
    hydrationPct: YEAST_ANCHOR.hydrationPct,
    fatPct: 0,
  });
  return recipe / anchor;
}

/** The short-schedule surcharge for a dough that is `totalHours` from mix to bake. */
export function shortFermentFactor(totalHours: number, prefermentShare = 0): number {
  const excess = SHORT_FERMENT.amplitude * Math.exp(-Math.max(0, totalHours) / SHORT_FERMENT.hours);
  return 1 + excess * (1 - clamp(prefermentShare, 0, 1));
}

/** The bare power law: fresh yeast % that is ready after this many anchor hours. */
const powerLaw = (anchorHours: number, levelPct: number): number =>
  levelPct * (Math.max(0.05, anchorHours) / YEAST_ANCHOR.hours) ** -YEAST_TIME_EXPONENT;

/**
 * Fresh yeast, % of total flour, that gets this dough ready on this schedule.
 * Unclamped, so callers can tell when a schedule asks for the impossible.
 */
export function freshYeastFor(schedule: YeastSchedule, recipe: YeastRecipe = {}): number {
  const hours = yeastAnchorHours(schedule) / yeastRecipeCorrection(recipe);
  return (
    powerLaw(hours, YEAST_ANCHOR_FRESH_PCT) *
    shortFermentFactor(schedule.totalHours, recipe.prefermentShare)
  );
}

/**
 * The inverse: total hours from mix to bake for a given fresh-yeast dose, with
 * the cold hours held fixed. The dose falls strictly as the schedule grows, so
 * a bisection always finds the one answer.
 *
 * Returns the cold hours alone when the fridge time by itself is already more
 * than enough — the dough cannot be made to need less than its retard.
 */
export function hoursForFreshYeast(
  freshPct: number,
  schedule: Omit<YeastSchedule, 'totalHours'>,
  recipe: YeastRecipe = {},
): number {
  const cold = Math.max(0, schedule.coldHours ?? 0);
  const need = (total: number) => freshYeastFor({ ...schedule, totalHours: total }, recipe);
  const dose = Math.max(FRESH_YEAST_MIN_PCT / 10, freshPct);

  let lo = cold;
  let hi = cold + 1000;
  if (need(lo) <= dose) return lo;
  if (need(hi) >= dose) return hi;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (need(mid) > dose) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── Preferments ────────────────────────────────────────────────────────────

export type YeastedPreferment = 'poolish' | 'biga';

/**
 * Fresh yeast, % of the preferment's own flour, that ripens it in 12 anchor
 * hours. Same power law and temperature model as the dough; only the level
 * differs, because "ripe" means something different for each.
 *
 * - Poolish: fitted to both ends of the classic rule, 0.1% for 12–15 h and
 *   1.5% for 3 h at about 21 °C. The rule's middle point (0.7% for 6–8 h) sits
 *   off any smooth curve through its ends, so it is not used.
 * - Biga: Giorilli's 1% for 18 h at 18 °C. A 44% biga is stiff, starved of
 *   water and meant to mature fully, so it takes far more yeast than a poolish
 *   for the same time.
 */
export const PREFERMENT_LEVEL_PCT: Record<YeastedPreferment, number> = {
  poolish: 0.139,
  biga: 1.06,
};

export interface PrefermentSchedule {
  hours: number;
  tempC: number;
  /** Hours of the build spent in the fridge, at the end of it. */
  coldHours?: number;
  coldTempC?: number;
}

/** Fresh yeast, % of the preferment's own flour, that has it ripe on time. */
export function prefermentYeastFor(type: YeastedPreferment, s: PrefermentSchedule): number {
  const hours = yeastAnchorHours({
    totalHours: s.hours,
    roomTempC: s.tempC,
    coldHours: s.coldHours,
    coldTempC: s.coldTempC,
  });
  return powerLaw(hours, PREFERMENT_LEVEL_PCT[type]);
}

/**
 * A ripe preferment carries at least this much leavening, as fresh yeast on
 * its own flour, whatever went into it: the yeast has multiplied several times
 * over a long build. Set so a classic pizza poolish — a third of the flour,
 * ripened overnight — leaves the final dough needing little or no extra yeast
 * for a same-day bake, which is how it is made.
 */
export const RIPE_PREFERMENT_POTENCY_PCT = 1;

/**
 * The leavening a ripe preferment brings to the final dough, as fresh yeast on
 * the TOTAL flour. A preferment loaded with more yeast than the floor still
 * carries everything it was given.
 */
export function prefermentLeavening(shareOfTotalFlour: number, yeastFreshPct: number): number {
  const share = clamp(shareOfTotalFlour, 0, 1);
  return share * Math.max(RIPE_PREFERMENT_POTENCY_PCT, yeastFreshPct);
}

// ── Forms ──────────────────────────────────────────────────────────────────

/** Fresh yeast % → the same leavening in another form. */
export const freshToForm = (freshPct: number, form: YeastForm): number =>
  freshPct * YEAST_CONVERSION[form];

/** A dose in some form → fresh yeast %. */
export const formToFresh = (pct: number, form: YeastForm): number =>
  pct / YEAST_CONVERSION[form];
