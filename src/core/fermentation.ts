/**
 * The fermentation model.
 *
 * Two clocks, one per kind of leavening:
 *
 *  - A levain runs on the measured sourdough curve in `./growth`, with cold
 *    hours converted by a dough Q10 validated against Full Proof Baking.
 *  - Commercial yeast runs on TXCraig1's yeast model in `./yeast`, temperature
 *    from Gänzle's growth-rate curve, fridge included.
 *
 * Both answer the same two questions — how much for this time, how long for
 * this much — and both are monotone: more leavening is less time, warmer is
 * less time. Salt, sugar, hydration and fat are corrections on top.
 */

import {
  DEFAULT_COLD_TEMP_C,
  FRIDGE_COOLDOWN_HOURS,
  HYBRID_SHARE,
  INOCULATION_MAX,
  INOCULATION_MIN,
  Q10,
  Q10_STARTER,
  STARTER_PEAK_REF_HOURS,
  STARTER_PEAK_REF_TEMP_C,
  clamp,
  rateRatio,
  round,
} from './constants';
import type { YeastForm } from './constants';
import type { LeavenType } from './types';
import { freshYeastToStarterPct, leavenPctForTotal } from './growth';
import {
  FRESH_YEAST_MAX_PCT,
  FRESH_YEAST_MIN_PCT,
  RIPE_PREFERMENT_POTENCY_PCT,
  freshToForm,
  freshYeastFor,
} from './yeast';

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
  /** Hours from mix to bake, fridge included. */
  totalHours: number;
  /** Hours of the total spent in the fridge. */
  coldHours?: number;
  coldTemp?: number;
  roomTemp: number;
  saltPct: number;
  sugarPct: number;
  hydrationPct: number;
  fatPct: number;
  yeastForm: YeastForm;
  leavenType: LeavenType;
  /** Share of the total flour that arrives in a ripe preferment, %. */
  prefermentFlourPct?: number;
  /**
   * Leavening the ripe preferment carries in, as fresh yeast on the total
   * flour. Defaults to what a just-ripe preferment of that size carries.
   */
  prefermentLeaveningPct?: number;
  /** A final-dough dose the baker has fixed, as fresh yeast; overrides the clock. */
  fixedFreshPct?: number;
}

export interface YeastDose {
  /** Yeast added to the final dough, in the requested form, % of total flour. */
  pct: number;
  /** The same as fresh yeast. */
  freshPct: number;
  /** What the schedule needs from commercial yeast before the preferment's share, fresh. */
  neededFreshPct: number;
  /** The fresh dose expressed as ripe starter, for comparing the two leavens. */
  starterEquivalentPct: number;
  clamped: boolean;
  /** Which practical limit the dose ran into: too short a schedule, or too long. */
  limit?: 'max' | 'min';
}

/**
 * Commercial yeast for the final dough, in the requested form.
 *
 * Runs the yeast clock (`./yeast`) for the whole schedule from mix to bake,
 * then takes off whatever a ripe preferment already brings. In hybrid mode
 * the levain carries the other half of the leavening.
 */
export function computeYeastDose(input: YeastDoseInput): YeastDose {
  if (input.leavenType === 'sourdough') {
    return { pct: 0, freshPct: 0, neededFreshPct: 0, starterEquivalentPct: 0, clamped: false };
  }

  const share = clamp((input.prefermentFlourPct ?? 0) / 100, 0, 1);
  const needed =
    freshYeastFor(
      {
        totalHours: input.totalHours,
        roomTempC: input.roomTemp,
        coldHours: input.coldHours,
        coldTempC: input.coldTemp,
      },
      {
        saltPct: input.saltPct,
        sugarPct: input.sugarPct,
        hydrationPct: input.hydrationPct,
        fatPct: input.fatPct,
        prefermentShare: share,
      },
    ) * (input.leavenType === 'hybrid' ? HYBRID_SHARE : 1);

  const carried = input.prefermentLeaveningPct ?? share * RIPE_PREFERMENT_POTENCY_PCT;
  const raw = input.fixedFreshPct ?? needed - carried;

  // A preferment that already carries the whole load needs nothing added.
  if (raw <= 0) {
    return { pct: 0, freshPct: 0, neededFreshPct: needed, starterEquivalentPct: 0, clamped: false };
  }

  const fresh = clamp(raw, FRESH_YEAST_MIN_PCT, FRESH_YEAST_MAX_PCT);
  const limit = raw > FRESH_YEAST_MAX_PCT ? 'max' : raw < FRESH_YEAST_MIN_PCT ? 'min' : undefined;

  return {
    pct: round(freshToForm(fresh, input.yeastForm), 4),
    freshPct: round(fresh, 4),
    neededFreshPct: needed,
    starterEquivalentPct: round(freshYeastToStarterPct(fresh), 2),
    clamped: limit !== undefined,
    limit,
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
