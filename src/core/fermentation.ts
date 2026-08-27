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
  /** Reference dose of fresh yeast, % of flour, at the reference conditions. */
  baseFreshPct: number;
  refHours: number;
  refTempC: number;
  /** Room-equivalent hours the dough will actually ferment. */
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
}

export interface YeastDose {
  /** Final dose in the requested yeast form, % of total flour. */
  pct: number;
  freshPct: number;
  clamped: boolean;
  corrections: {
    time: number;
    temperature: number;
    salt: number;
    sugar: number;
    hydration: number;
    fat: number;
    form: number;
    preferment: number;
  };
}

/**
 * Commercial yeast dose, in the requested form, as a % of total flour.
 *
 * Each correction is a multiplier on the reference dose, and each is clamped so
 * that a nonsense input (95% hydration, 6% salt) can bend the answer but never
 * break it.
 */
export function computeYeastDose(input: YeastDoseInput): YeastDose {
  const identity = {
    time: 1,
    temperature: 1,
    salt: 1,
    sugar: 1,
    hydration: 1,
    fat: 1,
    form: 1,
    preferment: 1,
  };

  if (input.leavenType === 'sourdough' || input.baseFreshPct <= 0) {
    return { pct: 0, freshPct: 0, clamped: false, corrections: identity };
  }

  // 1. Time. Half the time needs twice the yeast.
  const time = input.refHours / Math.max(0.25, input.effectiveHours);

  // 2. Temperature. A warmer room ferments faster, so it needs proportionally less.
  const temperature = 1 / rateRatio(input.roomTemp, input.refTempC);

  // 3. Salt draws water out of yeast cells; above 2% it measurably slows them.
  const salt = clamp(
    1 + CORRECTION_SLOPE.saltPerPctOver2 * (input.saltPct - 2),
    ...CORRECTION_CLAMP.salt,
  );

  // 4. Sugar feeds yeast up to ~8%, then starts stressing it osmotically.
  const sugarRaw =
    input.sugarPct <= 8
      ? 1 + CORRECTION_SLOPE.sugarPerPctUnder8 * input.sugarPct
      : 1 +
        CORRECTION_SLOPE.sugarPerPctUnder8 * 8 +
        CORRECTION_SLOPE.sugarPerPctOver8 * (input.sugarPct - 8);
  const sugar = clamp(sugarRaw, ...CORRECTION_CLAMP.sugar);

  // 5. A wetter dough is more mobile: enzymes and gas move faster.
  const hydration = clamp(
    1 + CORRECTION_SLOPE.hydrationPerPctOver62 * (input.hydrationPct - 62),
    ...CORRECTION_CLAMP.hydration,
  );

  // 6. Fat coats the gluten and slows gas capture in rich doughs.
  const fat = clamp(
    1 + CORRECTION_SLOPE.fatPerPctOver5 * Math.max(0, input.fatPct - 5),
    ...CORRECTION_CLAMP.fat,
  );

  // 7. A preferment arrives already full of active yeast, so the final dough
  //    needs less. The discount scales with how much of the flour was pre-fermented.
  const preferment = 1 - 0.6 * clamp((input.prefermentFlourPct ?? 0) / 100, 0, 1);

  // 8. In hybrid mode the levain carries half the lift.
  const hybrid = input.leavenType === 'hybrid' ? 0.5 : 1;

  const freshRaw =
    input.baseFreshPct * time * temperature * salt * sugar * hydration * fat * preferment * hybrid;

  const form = YEAST_CONVERSION[input.yeastForm];
  const dosed = freshRaw * form;
  const pct = clamp(dosed, YEAST_PCT_MIN, YEAST_PCT_MAX);

  return {
    pct: round(pct, 4),
    freshPct: round(freshRaw, 4),
    clamped: Math.abs(pct - dosed) > 1e-9,
    corrections: { time, temperature, salt, sugar, hydration, fat, form, preferment },
  };
}

export interface InoculationInput {
  /** Reference inoculation (starter flour as % of total flour) at the reference conditions. */
  basePct: number;
  refHours: number;
  refTempC: number;
  effectiveHours: number;
  roomTemp: number;
  leavenType: LeavenType;
}

/**
 * Levain inoculation as a % of total flour, i.e. how much of the dough's flour
 * arrives already fermented in the starter. Scales exactly like the yeast dose:
 * more time or a warmer room means less starter.
 */
export function computeInoculationPct(input: InoculationInput): number {
  if (input.leavenType === 'commercial' || input.basePct <= 0) return 0;

  const time = input.refHours / Math.max(0.25, input.effectiveHours);
  const temperature = 1 / rateRatio(input.roomTemp, input.refTempC);
  const hybrid = input.leavenType === 'hybrid' ? 0.5 : 1;

  const scaled = input.basePct * time * temperature * hybrid;
  return round(clamp(scaled, INOCULATION_MIN, INOCULATION_MAX), 1);
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
