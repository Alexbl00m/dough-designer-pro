/**
 * Physical and empirical constants for the fermentation model.
 *
 * Every number here is a modelling choice, not a law of nature. They are kept
 * in one place so they can be reviewed, tested and tuned without hunting
 * through the engine.
 */

/**
 * Q10 coefficient for a *dough*: how many times faster fermentation runs when
 * the dough is 10 °C warmer.
 *
 * Validated against Full Proof Baking's published bulk times at a fixed 20%
 * levain — 7 h at 21.1 °C, 6 h at 23.3 °C, 4.5–5 h at 26.7 °C. Q10 = 2.0
 * reproduces all three to within 0.2%; 2.2 is 3.4% out and 2.5 is 7.5% out.
 */
export const Q10 = 2.0;

/**
 * Q10 for a *starter reaching its peak*, which is markedly steeper than for a
 * dough. A starter has to consume a fixed amount of fresh food before it peaks,
 * so temperature compresses both its lag phase and its growth rate — the two
 * effects compound.
 *
 * Validated against the peak times in Russell Peace Baker's starter guide at a
 * fixed ratio and hydration — 10–14 h at 18 °C, 6–8 h at 22 °C, 3–5 h at 26 °C.
 * Q10 = 3.8 lands inside all three windows; the dough value of 2.0 would
 * predict a peak roughly 20% too fast in a cold kitchen and too slow in a warm one.
 */
export const Q10_STARTER = 3.8;

/**
 * A standard maintenance feed peaks in about this long at
 * `STARTER_PEAK_REF_TEMP_C`.
 *
 * Anchored on Russell Peace Baker's published windows, which is the source that
 * gives a full temperature curve rather than a single point: 10–14 h at 18 °C,
 * 6–8 h at 22 °C, 3–5 h at 26 °C. 7.5 h at 22 °C sits inside all three once the
 * Q10 above is applied.
 *
 * A higher-dilution feed runs longer than this — Full Proof Baking reports 5–6 h
 * at 26.7 °C for a 1:2:2, against roughly 4 h here — so treat the prediction as
 * the middle of a window, not a deadline.
 */
export const STARTER_PEAK_REF_HOURS = 7.5;
export const STARTER_PEAK_REF_TEMP_C = 22;
/** Seed as a share of the finished levain weight: 1 part in 5 is a 1:2:2 feed. */
export const LEVAIN_SEED_SHARE = 0.2;

/** Temperature the model normalises everything to when no other reference is given. */
export const REFERENCE_TEMP_C = 23;

/**
 * Dough does not reach fridge temperature instantly. A shaped loaf or a tub of
 * bulk dough takes roughly this long to come down, and it ferments briskly on
 * the way. The model counts this lag at the midpoint temperature instead of
 * pretending the dough is cold from minute one.
 */
export const FRIDGE_COOLDOWN_HOURS = 1.5;

/** Default fridge temperature when the user has not set one. */
export const DEFAULT_COLD_TEMP_C = 4;

/**
 * Conversion between yeast forms, by weight, relative to fresh (compressed) yeast.
 * Fresh is ~30% solids, active dry ~93%, instant ~95% with better viability.
 */
export const YEAST_CONVERSION = {
  fresh: 1,
  active_dry: 0.4,
  instant: 0.33,
} as const;

export type YeastForm = keyof typeof YEAST_CONVERSION;

/**
 * Friction factor: °C the dough gains from the mixing itself. Hand mixing adds
 * almost nothing; a spiral mixer running to full development adds a lot.
 */
export const FRICTION_FACTOR_C = {
  hand: 2,
  dlx: 4,
  planetary: 6,
  spiral: 8,
} as const;

export type MixingMethod = keyof typeof FRICTION_FACTOR_C;

/** Practical water temperature range: below 1 °C you are pouring ice, above 55 °C you kill yeast. */
export const WATER_TEMP_MIN_C = 1;
export const WATER_TEMP_MAX_C = 55;

/** Yeast starts dying around here; warn the baker before they scald it. */
export const YEAST_DANGER_TEMP_C = 50;

/** Practical limits for commercial yeast as a share of flour. */
export const YEAST_PCT_MIN = 0.005;
export const YEAST_PCT_MAX = 4;

/**
 * Practical limits for levain inoculation (starter flour as a share of total
 * flour). The floor is deliberately low: a long room-temperature ferment
 * genuinely wants only a few percent of levain, and clamping at 3% used to pin
 * every ferment past about 14 hours to the same answer.
 */
export const INOCULATION_MIN = 0.1;
export const INOCULATION_MAX = 50;
/** Above this the dough is levain-dominant and behaves very differently; worth a note. */
export const INOCULATION_HIGH = 20;

/** In hybrid mode the yeast and the levain each carry half the load. */
export const HYBRID_SHARE = 0.5;

/** Correction clamps so extreme user input can never produce an absurd dose. */
export const CORRECTION_CLAMP = {
  salt: [0.75, 1.5] as const,
  sugar: [0.8, 1.6] as const,
  hydration: [0.7, 1.3] as const,
  fat: [0.85, 1.4] as const,
};

/**
 * Correction slopes, expressed as "fractional change in the required yeast dose
 * per unit of the parameter".
 *
 * - Salt is osmotically hostile to yeast: every extra 1% above 2% needs ~7% more yeast.
 * - Sugar feeds yeast at low doses but stresses it osmotically above ~8%.
 * - Water mobilises enzymes and gas, so a wetter dough ferments faster and needs less.
 * - Fat coats gluten and slows gas capture; rich doughs need a nudge up.
 */
export const CORRECTION_SLOPE = {
  saltPerPctOver2: 0.07,
  sugarPerPctUnder8: -0.005,
  sugarPerPctOver8: 0.03,
  hydrationPerPctOver62: -0.005,
  fatPerPctOver5: 0.01,
};

/** Rounding helpers used across the engine so displayed numbers always agree. */
export const round = (value: number, decimals = 0): number => {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Relative fermentation rate at `temp` compared to `reference`, from the Q10
 * model. A dough at 33 °C ferments `Q10`× as fast as the same dough at 23 °C.
 *
 * Pass `Q10_STARTER` for a starter build; a dough and a starter do not share a
 * coefficient.
 */
export const rateRatio = (
  temp: number,
  reference: number = REFERENCE_TEMP_C,
  q10: number = Q10,
): number => q10 ** ((temp - reference) / 10);
