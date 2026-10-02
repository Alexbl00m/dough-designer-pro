/**
 * Measured fermentation curve.
 *
 * Source: a sourdough fermentation-time table giving bulk and proof hours for
 * eight temperatures × eight starter percentages, at 2% salt and 75% hydration.
 *
 * Fitting `t_bulk = k(T) · log₂(S* / inoculation)` to all 64 points recovers a
 * near-constant S* of 97.7% across every temperature (max residual 4.5%), which
 * is what makes the shape trustworthy rather than merely fitted: the same law
 * describes every row, and only `k` moves with temperature.
 *
 * The important consequence is that fermentation time is **logarithmic** in the
 * dose, not inversely proportional to it. Fifty times the starter is 3.7× the
 * speed, not fifty times. That follows from the yeast growing during the
 * ferment: the starting population only buys you a fixed number of doublings,
 * so `k` is a doubling time and doubling the dose saves exactly `k` hours
 * whatever the dose was.
 */

export interface FermentationAnchor {
  tempC: number;
  /** Hours saved per doubling of the leavening dose — the population doubling time. */
  doublingHours: number;
  /** Final proof hours. Varies only ~16% across a 50× dose range, so it is treated
   *  as temperature-only. */
  proofHours: number;
}

/**
 * The inoculation at which bulk time reaches zero — a dough made entirely of
 * ripe starter is, by definition, already fermented. Recovered from the fit
 * rather than assumed.
 */
export const FULL_FERMENT_PCT = 97.7;

/**
 * `doublingHours` is a least-squares fit of the slope of bulk time against
 * log₂(inoculation) for each temperature row.
 *
 * Note how the implied Q10 is not constant: about 5.4 between 10 and 13 °C,
 * 3.0 around 21–24 °C, and 1.3 approaching 29 °C. Yeast has an optimum, and a
 * single Q10 cannot describe both a cold retard and a proofing box. This is why
 * the curve is interpolated from measurements instead of generated.
 */
export const FERMENTATION_CURVE: FermentationAnchor[] = [
  { tempC: 10.0, doublingHours: 12.031, proofHours: 19.12 },
  { tempC: 12.8, doublingHours: 7.514, proofHours: 11.94 },
  { tempC: 15.6, doublingHours: 4.785, proofHours: 7.61 },
  { tempC: 18.3, doublingHours: 3.138, proofHours: 4.99 },
  { tempC: 21.1, doublingHours: 2.153, proofHours: 3.42 },
  { tempC: 23.9, doublingHours: 1.579, proofHours: 2.51 },
  { tempC: 26.7, doublingHours: 1.277, proofHours: 2.03 },
  { tempC: 29.4, doublingHours: 1.198, proofHours: 1.9 },
];

/** The conditions the table was measured under; corrections are relative to these. */
export const TABLE_SALT_PCT = 2;
export const TABLE_HYDRATION_PCT = 75;

/**
 * How much starter one percent of fresh yeast is worth, by leavening power.
 *
 * The table covers sourdough only. Commercial yeast follows the same growth law
 * — it is the same kind of organism doubling on the same clock — but a gram of
 * fresh yeast carries far more cells than a gram of starter, so it enters the
 * curve at a different point.
 *
 * Calibrated against straight-dough practice across the whole usable range,
 * which matters because the law is logarithmic and a factor chosen at one end
 * goes wrong at the other: 0.025% fresh for an overnight pizza dough at 21 °C,
 * 0.1% for most of a working day, 1% for a couple of hours at 24 °C. Thirty
 * reproduces all three; fifty fits the middle but pushes the top of the range
 * past `FULL_FERMENT_PCT`, where the model would claim a dough is ready before
 * it has been mixed.
 *
 * This one number is calibrated against practice rather than measured, so it is
 * the least certain constant in the engine and the first place to look if
 * commercial-yeast timings feel off.
 */
export const FRESH_YEAST_TO_STARTER = 30;

/**
 * Beyond this dose a dough ferments faster than the curve usefully predicts,
 * and the baker should be watching it rather than a clock.
 */
export const VERY_FAST_LEAVEN_PCT = 60;
