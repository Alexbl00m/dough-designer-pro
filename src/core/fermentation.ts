/**
 * The fermentation model.
 *
 * Two ideas carry everything here:
 *
 *  1. Fermentation *rate* follows a Q10 law — every 10 °C roughly doubles it.
 *  2. Total gas produced is rate × time. So to keep a dough "ready" at a
 *     different time or temperature, you scale the leavening dose by the
 *     inverse of the change in rate × time.
 *
 * Everything else — cold retards, salt, sugar, hydration, fat — is a correction
 * on top of those two.
 */

import {
  CORRECTION_CLAMP,
  CORRECTION_SLOPE,
  DEFAULT_COLD_TEMP_C,
  FRIDGE_COOLDOWN_HOURS,
  INOCULATION_MAX,
  INOCULATION_MIN,
  Q10,
  Q10_STARTER,
  STARTER_PEAK_REF_HOURS,
  STARTER_PEAK_REF_TEMP_C,
  YEAST_CONVERSION,
  YEAST_PCT_MAX,
  YEAST_PCT_MIN,
  clamp,
  rateRatio,
  round,
} from './constants';
import type { YeastForm } from './constants';
import type { LeavenType } from './types';
import { leavenPctForTotal, starterToFreshYeastPct } from './growth';

export interface RoomEquivInput {
  totalHours: number;
  coldHours: number;
  roomTemp: number;
  coldTemp?: number;
}

/**
 * Convert a schedule that is partly at room temperature and partly in the
 * fridge into the number of room-temperature hours it is equivalent to.
 *
 * The dough does not become cold the instant it goes in the fridge — a 2 kg tub
 * takes hours to come down and ferments briskly on the way. The first
 * `FRIDGE_COOLDOWN_HOURS` are therefore counted at the midpoint between room
 * and fridge temperature, which is the single biggest reason naive cold-retard
 * maths under-doses yeast and leaves bakers with a flat dough.
 */
export function computeRoomEquivHours({
  totalHours,
  coldHours,
  roomTemp,
  coldTemp = DEFAULT_COLD_TEMP_C,
}: RoomEquivInput): number {
  const total = Math.max(0, totalHours);
  const cold = clamp(coldHours, 0, total);
  const warm = total - cold;

  const lag = Math.min(cold, FRIDGE_COOLDOWN_HOURS);
  const settled = cold - lag;
  const lagTemp = (roomTemp + coldTemp) / 2;

  const equiv =
    warm + lag * rateRatio(lagTemp, roomTemp) + settled * rateRatio(coldTemp, roomTemp);

  // Never return zero: a 0 h ferment would demand infinite yeast downstream.
  return Math.max(0.25, equiv);
}

/** How much slower the fridge runs than the room, as a plain fraction. */
export function coldSlowdownFactor(roomTemp: number, coldTemp = DEFAULT_COLD_TEMP_C): number {
  return rateRatio(coldTemp, roomTemp);
}

export interface YeastDoseInput {
  /** Room-equivalent hours the dough will actually ferment, bulk plus proof. */
  effectiveHours: number;
  roomTemp: number;
  saltPct: number;
  sugarPct: number;
  hydrationPct: number;
  fatPct: number;
  yeastForm: YeastForm;
  leavenType: LeavenType;
  /** A preferment already carries part of the leavening; discount the final dose. */
  prefermentFlourPct?: number;
  /** Scales the whole clock for this style. See `BreadStyle.fermentFactor`. */
  fermentFactor?: number;
}

export interface YeastDose {
  /** Final dose in the requested yeast form, % of total flour. */
  pct: number;
  freshPct: number;
  /** What this dose is worth as ripe starter — the currency both leavens share. */
  starterEquivalentPct: number;
  clamped: boolean;
}

/**
 * Commercial yeast dose for a target time, in the requested form.
 *
 * Runs the same growth curve as sourdough and converts at the end, so the two
 * leavening sliders always tell the same story: more leavening is less time,
 * warmer is less time, and switching from starter to yeast does not silently
 * change the schedule.
 */
export function computeYeastDose(input: YeastDoseInput): YeastDose {
  if (input.leavenType === 'sourdough') {
    return { pct: 0, freshPct: 0, starterEquivalentPct: 0, clamped: false };
  }

  const clock = {
    tempC: input.roomTemp,
    saltPct: input.saltPct,
    sugarPct: input.sugarPct,
    hydrationPct: input.hydrationPct,
    fatPct: input.fatPct,
  };

  const hours = input.effectiveHours / (input.fermentFactor ?? 1);
  let starterEquivalent = leavenPctForTotal(hours, clock);

  // A preferment arrives already full of active yeast, so the final dough needs
  // less. In a logarithmic world that is a subtraction of leavening power, not
  // a multiplier on the dose.
  const prefermentShare = clamp((input.prefermentFlourPct ?? 0) / 100, 0, 1);
  starterEquivalent *= 1 - 0.6 * prefermentShare;

  // In hybrid mode the levain supplies half the leavening power; cell counts
  // add, so each side carries half the starter-equivalent dose.
  if (input.leavenType === 'hybrid') starterEquivalent *= 0.5;

  const freshRaw = starterToFreshYeastPct(starterEquivalent);
  const dosed = freshRaw * YEAST_CONVERSION[input.yeastForm];
  const pct = clamp(dosed, YEAST_PCT_MIN, YEAST_PCT_MAX);

  return {
    pct: round(pct, 4),
    freshPct: round(freshRaw, 4),
    starterEquivalentPct: round(starterEquivalent, 2),
    clamped: Math.abs(pct - dosed) > 1e-9,
  };
}

export interface InoculationInput {
  /** Room-equivalent hours the dough will actually ferment, bulk plus proof. */
  effectiveHours: number;
  roomTemp: number;
  saltPct?: number;
  sugarPct?: number;
  hydrationPct?: number;
  fatPct?: number;
  leavenType: LeavenType;
  starterHydrationPct?: number;
  /** Scales the whole clock for this style. See `BreadStyle.fermentFactor`. */
  fermentFactor?: number;
}

/**
 * Levain inoculation for a target time, as starter flour over TOTAL flour.
 *
 * The curve works in the convention recipes use — ripe levain over the flour it
 * joins — so the result is converted at the end. Both are reported downstream
 * because confusing them is how a recipe ends up with the wrong amount of starter.
 */
export function computeInoculationPct(input: InoculationInput): number {
  if (input.leavenType === 'commercial') return 0;

  const hours = input.effectiveHours / (input.fermentFactor ?? 1);
  let onFlour = leavenPctForTotal(hours, {
    tempC: input.roomTemp,
    saltPct: input.saltPct,
    sugarPct: input.sugarPct,
    hydrationPct: input.hydrationPct,
    fatPct: input.fatPct,
  });

  // Hybrid: the yeast carries the other half of the leavening power.
  if (input.leavenType === 'hybrid') onFlour *= 0.5;

  // Three decimals, not one: a long room-temperature ferment lands under 0.2%
  // of the total flour, and rounding that to a single decimal collapses a whole
  // range of real doses onto the same answer.
  return round(
    clamp(
      inoculationFromLevainOnFlour(onFlour, input.starterHydrationPct ?? 100),
      INOCULATION_MIN,
      INOCULATION_MAX,
    ),
    3,
  );
}

/**
 * Invert `levainOnFlourPct`: ripe levain over dough flour → starter flour over
 * total flour. The two denominators differ by the starter's own flour, so this
 * is not simply a halving.
 */
export function inoculationFromLevainOnFlour(
  onFlourPct: number,
  starterHydrationPct = 100,
): number {
  const ratio = onFlourPct / 100 / (1 + starterHydrationPct / 100);
  return (ratio / (1 + ratio)) * 100;
}

/**
 * Desired dough temperature → water temperature.
 *
 * The classic bakery rule: multiply the target by the number of temperature
 * factors in the mix, then subtract every factor you cannot control. Water is
 * the one you can, so it absorbs the whole correction.
 *
 * Three factors for a straight dough (flour, room, friction); four when a
 * preferment goes into the mix, since it brings its own temperature.
 */
export function computeWaterTemp(params: {
  desiredDoughTempC: number;
  flourTempC: number;
  roomTempC: number;
  frictionC: number;
  prefermentTempC?: number;
}): { rawTempC: number; factors: number } {
  const hasPreferment = typeof params.prefermentTempC === 'number';
  const factors = hasPreferment ? 4 : 3;
  const known =
    params.flourTempC +
    params.roomTempC +
    params.frictionC +
    (hasPreferment ? (params.prefermentTempC as number) : 0);
  return { rawTempC: params.desiredDoughTempC * factors - known, factors };
}

/**
 * When the calculated water temperature is below what a cold tap gives you
 * (~12 °C), swap part of the water for ice. Returns the grams of ice to use out
 * of the total water weight, assuming tap water at `tapTempC`.
 *
 * Melting ice absorbs 80 cal/g, which is why a little ice goes a long way.
 */
export function computeIceSplit(
  waterGrams: number,
  targetTempC: number,
  tapTempC = 12,
): number {
  if (waterGrams <= 0 || targetTempC >= tapTempC) return 0;
  // Heat balance: tap water cools from tapTemp to target; ice at 0 °C melts (80 cal/g)
  // and then warms to target.
  const iceFraction = (tapTempC - targetTempC) / (80 + tapTempC);
  return round(clamp(iceFraction, 0, 0.9) * waterGrams, 0);
}

/**
 * Convert the engine's inoculation (starter flour as a share of TOTAL flour)
 * into the figure recipes quote: ripe levain as a share of the flour it joins.
 *
 * These differ because the total includes the starter's own flour, so the same
 * levain is a larger share of the smaller denominator. Full Proof Baking's
 * "20% levain" is 9.1% in the engine's convention — quoting the wrong one at a
 * baker is how a recipe ends up with half the starter it needed.
 */
export function levainOnFlourPct(inoculationPct: number, starterHydrationPct = 100): number {
  if (inoculationPct <= 0 || inoculationPct >= 100) return 0;
  const levain = inoculationPct * (1 + starterHydrationPct / 100);
  return round((levain / (100 - inoculationPct)) * 100, 1);
}

/**
 * How long a levain takes to peak at `tempC`, for a standard maintenance feed.
 *
 * This is deliberately *not* the dough's Q10: a starter has to eat through a
 * fixed amount of fresh flour before it peaks, so temperature compresses its
 * lag phase and its growth rate together. Using the dough coefficient here is
 * what makes a schedule tell a baker with an 18 °C kitchen that their levain
 * will be ready in five hours when it really needs eleven.
 */
export function starterPeakHours(tempC: number): number {
  const hours =
    STARTER_PEAK_REF_HOURS / rateRatio(tempC, STARTER_PEAK_REF_TEMP_C, Q10_STARTER);
  // Below ~14 °C a starter crawls; above ~30 °C it peaks and collapses fast.
  return round(clamp(hours, 2, 24), 1);
}

export { Q10, Q10_STARTER, INOCULATION_MIN, INOCULATION_MAX };
