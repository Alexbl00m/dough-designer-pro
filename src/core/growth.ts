/**
 * The fermentation clock.
 *
 * Everything here is one law and its inverse:
 *
 *     bulk hours = k(T) · log₂(S* / leaven%)
 *     leaven%    = S* / 2^(hours / k(T))
 *
 * `k(T)` is the population doubling time, interpolated from measurements, and
 * `S*` is the dose at which the dough is already fermented. Because the two
 * directions are the same equation rearranged, a slider that sets the time and
 * a slider that sets the dose can never disagree.
 *
 * Both directions speak one currency — "starter-equivalent percent", meaning
 * ripe 100%-hydration levain as a share of the flour it joins.
 *
 * This is the levain's clock. Commercial yeast has its own, in `./yeast`: a
 * pinch of instant yeast dosed for a whole schedule does not behave like a
 * levain followed by a final proof, and running it on this curve is what used
 * to pin short yeasted doughs at a ceiling and long ones at a floor.
 */

import {
  FERMENTATION_CURVE,
  FRESH_YEAST_TO_STARTER,
  FULL_FERMENT_PCT,
  TABLE_HYDRATION_PCT,
  TABLE_SALT_PCT,
} from '@/data/fermentationTable';
import { CORRECTION_CLAMP, CORRECTION_SLOPE, clamp, round } from './constants';

/** Practical bounds on the leavening dose, in starter-equivalent percent. */
export const LEAVEN_PCT_MIN = 0.2;
export const LEAVEN_PCT_MAX = 60;

/**
 * Linear interpolation of a curve anchor against temperature, in log space so
 * that the segments between measurements behave exponentially — locally a Q10,
 * globally the measured shape, which is not a single Q10 at all.
 *
 * Outside the measured range the end segment's slope continues, and the result
 * is clamped: below freezing nothing useful happens, and past the yeast optimum
 * the dough dies rather than speeding up further.
 */
function interpolate(tempC: number, pick: (a: (typeof FERMENTATION_CURVE)[number]) => number): number {
  const curve = FERMENTATION_CURVE;
  const t = clamp(tempC, -2, 45);

  let lo = 0;
  if (t <= curve[0].tempC) lo = 0;
  else if (t >= curve[curve.length - 1].tempC) lo = curve.length - 2;
  else {
    lo = curve.findIndex((a, i) => i < curve.length - 1 && t >= a.tempC && t < curve[i + 1].tempC);
    if (lo < 0) lo = curve.length - 2;
  }

  const a = curve[lo];
  const b = curve[lo + 1];
  const span = b.tempC - a.tempC;
  const f = span === 0 ? 0 : (t - a.tempC) / span;
  const value = Math.exp(Math.log(pick(a)) + f * (Math.log(pick(b)) - Math.log(pick(a))));

  // Past the optimum the curve flattens; never let extrapolation drive it to zero.
  return Math.max(0.2, value);
}

/** Hours saved per doubling of the dose at this temperature — the doubling time. */
export const doublingHoursAt = (tempC: number): number =>
  interpolate(tempC, (a) => a.doublingHours);

/** Final proof hours at this temperature, which barely depends on the dose. */
export const proofHoursAt = (tempC: number): number => interpolate(tempC, (a) => a.proofHours);

/**
 * How much slower this dough runs than the table's reference dough.
 *
 * The table was measured at 2% salt and 75% hydration. Salt is osmotically
 * hostile, sugar helps then hinders, water mobilises, fat coats the gluten —
 * each one stretches or compresses the clock. Returns a multiplier on time.
 */
export function timeCorrection(params: {
  saltPct: number;
  sugarPct: number;
  hydrationPct: number;
  fatPct: number;
}): number {
  const salt = clamp(
    1 + CORRECTION_SLOPE.saltPerPctOver2 * (params.saltPct - TABLE_SALT_PCT),
    ...CORRECTION_CLAMP.salt,
  );
  const sugarRaw =
    params.sugarPct <= 8
      ? 1 + CORRECTION_SLOPE.sugarPerPctUnder8 * params.sugarPct
      : 1 +
        CORRECTION_SLOPE.sugarPerPctUnder8 * 8 +
        CORRECTION_SLOPE.sugarPerPctOver8 * (params.sugarPct - 8);
  const sugar = clamp(sugarRaw, ...CORRECTION_CLAMP.sugar);
  const hydration = clamp(
    1 + CORRECTION_SLOPE.hydrationPerPctOver62 * (params.hydrationPct - TABLE_HYDRATION_PCT),
    ...CORRECTION_CLAMP.hydration,
  );
  const fat = clamp(
    1 + CORRECTION_SLOPE.fatPerPctOver5 * Math.max(0, params.fatPct - 5),
    ...CORRECTION_CLAMP.fat,
  );
  return salt * sugar * hydration * fat;
}

export interface ClockParams {
  tempC: number;
  saltPct?: number;
  sugarPct?: number;
  hydrationPct?: number;
  fatPct?: number;
}

const correctionFor = (p: ClockParams): number =>
  timeCorrection({
    saltPct: p.saltPct ?? TABLE_SALT_PCT,
    sugarPct: p.sugarPct ?? 0,
    hydrationPct: p.hydrationPct ?? TABLE_HYDRATION_PCT,
    fatPct: p.fatPct ?? 0,
  });

/**
 * Bulk hours for a given dose. The forward direction: "I am using this much
 * starter — when will it be ready?"
 */
export function bulkHoursFor(leavenPct: number, p: ClockParams): number {
  const k = doublingHoursAt(p.tempC);
  const dose = clamp(leavenPct, LEAVEN_PCT_MIN, FULL_FERMENT_PCT - 0.5);
  const hours = k * Math.log2(FULL_FERMENT_PCT / dose) * correctionFor(p);
  // However much leavening goes in, gas still has to build a structure. Below
  // about half a doubling the dough is being mixed, not fermented, so the curve
  // is floored rather than allowed to run to zero.
  return round(Math.max(0.4 * k, hours), 2);
}

/**
 * The dose that lands bulk on a given number of hours. The inverse direction:
 * "I need it ready by six — how much starter?"
 *
 * Exactly the same equation rearranged, so the two can never drift apart.
 */
export function leavenPctFor(bulkHours: number, p: ClockParams): number {
  const hours = Math.max(0.1, bulkHours) / correctionFor(p);
  const dose = FULL_FERMENT_PCT / 2 ** (hours / doublingHoursAt(p.tempC));
  return round(clamp(dose, LEAVEN_PCT_MIN, LEAVEN_PCT_MAX), 2);
}

/** Total bulk + proof for a dose, which is what a baker actually schedules around. */
export function totalHoursFor(leavenPct: number, p: ClockParams): number {
  return round(bulkHoursFor(leavenPct, p) + proofHoursAt(p.tempC) * correctionFor(p), 2);
}

/** The dose that lands bulk *and* proof on a given total. */
export function leavenPctForTotal(totalHours: number, p: ClockParams): number {
  const proof = proofHoursAt(p.tempC) * correctionFor(p);
  return leavenPctFor(Math.max(0.1, totalHours - proof), p);
}

// ── Comparing the two leavens ──────────────────────────────────────────────

/**
 * Fresh yeast % → the starter % with roughly the same leavening power. Only for
 * putting a yeast dose in levain terms; the yeast clock itself is `./yeast`.
 */
export const freshYeastToStarterPct = (freshPct: number): number =>
  freshPct * FRESH_YEAST_TO_STARTER;

/** Starter % → the fresh yeast % that ferments at the same speed. */
export const starterToFreshYeastPct = (starterPct: number): number =>
  starterPct / FRESH_YEAST_TO_STARTER;

export { FULL_FERMENT_PCT, FRESH_YEAST_TO_STARTER };
