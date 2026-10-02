/**
 * The recipe engine.
 *
 * Takes a style plus the baker's parameters and returns a complete, internally
 * consistent recipe: ingredient weights that add up to the dough weight you
 * asked for, baker's percentages that match those weights, a leavening dose
 * scaled to the actual time and temperature, a water temperature that hits the
 * target dough temperature, and a wall-clock schedule.
 *
 * There are no per-style branches here. Everything a style needs to behave
 * differently is declared as data in `src/data/styles.ts`.
 */

import type { BreadStyle, IngredientType } from '@/data/styles';
import {
  DEFAULT_COLD_TEMP_C,
  FRICTION_FACTOR_C,
  INOCULATION_HIGH,
  LEVAIN_SEED_SHARE,
  WATER_TEMP_MAX_C,
  WATER_TEMP_MIN_C,
  YEAST_DANGER_TEMP_C,
  clamp,
  round,
} from './constants';
import {
  computeIceSplit,
  computeInoculationPct,
  computeRoomEquivHours,
  computeWaterTemp,
  computeYeastDose,
  levainOnFlourPct,
  starterPeakHours,
} from './fermentation';
import {
  bulkHoursFor,
  doublingHoursAt,
  leavenPctForTotal,
  proofHoursAt,
  timeCorrection,
  totalHoursFor,
} from './growth';
import { VERY_FAST_LEAVEN_PCT } from '@/data/fermentationTable';
import { LEAVEN_PCT_MIN } from './growth';
import { buildSchedule } from './schedule';
import type {
  CalculationInputs,
  CalculationResults,
  Ingredient,
  Note,
  RecipeSection,
} from './types';

export * from './types';
export * from './fermentation';
export {
  Q10,
  REFERENCE_TEMP_C,
  FRICTION_FACTOR_C,
  YEAST_CONVERSION,
  INOCULATION_MIN,
  INOCULATION_MAX,
  DEFAULT_COLD_TEMP_C,
} from './constants';

const YEAST_KEY: Record<string, string> = {
  fresh: 'ing.yeast_fresh',
  active_dry: 'ing.yeast_active_dry',
  instant: 'ing.yeast_instant',
};

/** Weights below 10 g are shown to two decimals; a 0.4 g yeast dose matters. */
export const formatGrams = (grams: number): string =>
  grams < 10 ? grams.toFixed(2) : Math.round(grams).toString();

export function calculateRecipe(inputs: CalculationInputs): CalculationResults {
  const { style } = inputs;
  const notes: Note[] = [];

  // ── 1. Resolve parameters: user overrides beat style defaults ──
  const hydration = clamp(inputs.hydration ?? style.defaultParams.hydration_pct, 30, 120);
  const salt = clamp(inputs.salt ?? style.defaultParams.salt_pct, 0, 6);
  const sugar = clamp(inputs.sugar ?? style.defaultParams.sugar_pct, 0, 40);
  const fat = clamp(inputs.oil ?? style.defaultParams.oil_pct, 0, 60);
  const starterHydration = clamp(inputs.starterHydration ?? 100, 40, 200);

  const roomTemp = clamp(inputs.roomTemp, 4, 40);
  const coldTemp = clamp(inputs.coldTemp ?? DEFAULT_COLD_TEMP_C, -2, 18);
  const totalTime = Math.max(0.5, inputs.totalTime);
  const coldPhase = inputs.coldPhase ?? style.process.coldPhase;
  const desiredDoughTemp = clamp(inputs.desiredDoughTemp, 15, 35);
  const flourTemp = inputs.flourTemp ?? roomTemp;
  const mixing = inputs.mixing;
  const yeastForm = inputs.yeastForm;
  const leavenType = inputs.leavenType;

  const usePreferment = (inputs.usePreferment ?? true) && Boolean(style.preferment);
  const preferment = usePreferment ? style.preferment : undefined;
  const percentBasis = inputs.percentBasis ?? 'total';

  // ── 2. Fermentation: the clock, run in whichever direction the baker holds ──
  const driver = inputs.driver ?? 'time';
  const clock = {
    tempC: roomTemp,
    saltPct: salt,
    sugarPct: sugar,
    hydrationPct: hydration,
    fatPct: fat,
  };
  const fermentFactor = style.fermentFactor ?? 1;
  const usesLevain = leavenType === 'sourdough' || leavenType === 'hybrid';

  // In dose mode the schedule follows from the dose; in time mode the dose
  // follows from the schedule. Both are the same equation, so the two agree.
  let requestedTotal: number;
  let leavenOnFlour: number;

  if (driver === 'dose') {
    leavenOnFlour = Math.max(0.2, inputs.leavenPct ?? style.defaultLevainPct ?? 20);
    requestedTotal = round(totalHoursFor(leavenOnFlour, clock) * fermentFactor, 2);
  } else {
    requestedTotal = totalTime;
    leavenOnFlour = leavenPctForTotal(totalTime / fermentFactor, clock);
  }

  const requestedCold = Math.max(0, inputs.coldHours ?? 0);
  const coldHours = Math.min(requestedCold, requestedTotal);

  if (requestedCold > requestedTotal) {
    notes.push({
      code: 'note.cold_clamped',
      severity: 'warn',
      values: { hours: round(coldHours, 1) },
    });
  }

  const roomEquivHours = computeRoomEquivHours({
    totalHours: requestedTotal,
    coldHours,
    roomTemp,
    coldTemp,
  });

  // Cold hours are worth less than clock hours, so the dose has to be set for
  // the room-equivalent time, not the time on the wall.
  if (driver === 'time') {
    leavenOnFlour = leavenPctForTotal(roomEquivHours / fermentFactor, clock);
  }

  const dose = computeYeastDose({
    effectiveHours: roomEquivHours,
    roomTemp,
    saltPct: salt,
    sugarPct: sugar,
    hydrationPct: hydration,
    fatPct: fat,
    yeastForm,
    leavenType,
    prefermentFlourPct: preferment?.flour_pct,
    fermentFactor,
  });

  const inoculationPct = usesLevain
    ? computeInoculationPct({
        effectiveHours: roomEquivHours,
        roomTemp,
        saltPct: salt,
        sugarPct: sugar,
        hydrationPct: hydration,
        fatPct: fat,
        leavenType,
        starterHydrationPct: starterHydration,
        fermentFactor,
      })
    : 0;

  // How long the levain itself needs is a function of the baker's kitchen, not
  // of any style reference: the same feed peaks in 4 h at 27 °C and 13 h at 18 °C.
  const levainPeakHours = starterPeakHours(roomTemp);

  const correction = timeCorrection({
    saltPct: salt,
    sugarPct: sugar,
    hydrationPct: hydration,
    fatPct: fat,
  });

  // ── 3. Solve the flour weight so the finished dough hits the target ──
  const extras = style.extras ?? [];
  const extrasPct = extras.reduce((sum, e) => sum + e.pct, 0);
  const prefermentExtrasPct = preferment
    ? (preferment.extras ?? []).reduce(
        (sum, e) => sum + e.pct * (preferment.flour_pct / 100),
        0,
      )
    : 0;

  // Fractions of the TOTAL flour that go into the preferment and the levain.
  // Everything below is expressed against total flour so the solve stays linear.
  const prefFlourFrac = preferment ? preferment.flour_pct / 100 : 0;
  const prefWaterFrac = prefFlourFrac * ((preferment?.hydration_pct ?? 0) / 100);
  const levainFlourFrac = inoculationPct / 100;
  const levainWaterFrac = levainFlourFrac * (starterHydration / 100);

  // On a dough basis the percentages are measured against only the flour added
  // directly to the final mix, so they buy proportionally less of everything.
  // The floor keeps a 100%-preferment style (where no fresh flour is added)
  // from collapsing the denominator to zero.
  const basisShare =
    percentBasis === 'dough'
      ? Math.max(0.05, 1 - prefFlourFrac - levainFlourFrac)
      : 1;

  const saltFrac = basisShare * (salt / 100);
  const sugarFrac = basisShare * (sugar / 100);
  const fatFrac = basisShare * (fat / 100);
  const extrasFrac = basisShare * (extrasPct / 100);

  // Water added to the final dough. On a total basis the stated hydration
  // covers every drop including the preferment's and the starter's, so those
  // come off; on a dough basis it covers only what goes into the final mix.
  const finalWaterFrac =
    percentBasis === 'dough'
      ? basisShare * (hydration / 100)
      : hydration / 100 - prefWaterFrac - levainWaterFrac;
  const totalWaterFrac = finalWaterFrac + prefWaterFrac + levainWaterFrac;

  // The levain and preferment add flour and water that are subtracted again
  // from the main dough, so they are weight-neutral. Yeast and extras add weight.
  const totalPct =
    100 +
    100 * (totalWaterFrac + saltFrac + sugarFrac + fatFrac + extrasFrac) +
    prefermentExtrasPct +
    dose.pct;

  const pieces = Math.max(1, Math.round(inputs.ballCount || 1));
  const scaleMode = inputs.scaleMode ?? 'pieces';

  let totalFlour: number;
  let targetDoughWeight: number;
  if (scaleMode === 'flour' && inputs.targetFlour) {
    totalFlour = Math.max(1, inputs.targetFlour);
    targetDoughWeight = totalFlour * (totalPct / 100);
  } else if (scaleMode === 'dough' && inputs.targetDough) {
    targetDoughWeight = Math.max(1, inputs.targetDough);
    totalFlour = targetDoughWeight / (totalPct / 100);
  } else {
    targetDoughWeight = Math.max(1, (inputs.ballWeight || 1) * pieces);
    totalFlour = targetDoughWeight / (totalPct / 100);
  }

  // ── 4. Split the flour and water between preferment, levain and final dough ──
  const totalWater = totalFlour * totalWaterFrac;
  const basisFlour = totalFlour * basisShare;

  const prefermentFlour = totalFlour * prefFlourFrac;
  const prefermentWater = totalFlour * prefWaterFrac;
  const prefermentSalt = preferment?.salt_pct
    ? prefermentFlour * (preferment.salt_pct / 100)
    : 0;
  const prefermentYeast = preferment?.yeast_fresh_pct
    ? prefermentFlour *
      (preferment.yeast_fresh_pct / 100) *
      (yeastForm === 'fresh' ? 1 : yeastForm === 'instant' ? 0.33 : 0.4)
    : 0;

  const levainFlour = totalFlour * levainFlourFrac;
  const levainWater = totalFlour * levainWaterFrac;
  const levainTotal = levainFlour + levainWater;

  const finalFlour = totalFlour - prefermentFlour - levainFlour;
  const finalWater = totalFlour * finalWaterFrac;

  if (finalFlour < 0) {
    notes.push({ code: 'note.flour_overdrawn', severity: 'warn' });
  }
  if (finalWater < 0) {
    notes.push({
      code: 'note.water_overdrawn',
      severity: 'warn',
      values: { hydration: round(hydration, 1) },
    });
  }

  // ── 5. Build the ingredient sections ──
  const sections: RecipeSection[] = [];
  const pct = (grams: number) => (basisFlour > 0 ? round((grams / basisFlour) * 100, 2) : 0);

  if (usesLevain && levainTotal > 0) {
    const levainIngredients: Ingredient[] = [
        {
        key: 'ing.starter_seed',
        grams: round(levainTotal * LEVAIN_SEED_SHARE, 1),
        percentage: pct(levainTotal * LEVAIN_SEED_SHARE),
        type: 'starter',
      },
      { key: 'ing.flour', grams: round(levainFlour, 1), percentage: pct(levainFlour), type: 'flour' },
      { key: 'ing.water', grams: round(levainWater, 1), percentage: pct(levainWater), type: 'water' },
    ];
    sections.push({
      id: 'levain',
      titleKey: 'section.levain',
      // The build time the baker needs is the one for their kitchen, not the
      // reference conditions the dose happens to be calibrated against.
      meta: { hours: levainPeakHours, tempC: roomTemp, type: 'levain' },
      ingredients: levainIngredients,
      totalGrams: round(levainTotal, 1),
    });
  }

  let prefermentExtrasGrams = 0;
  if (preferment) {
    const prefIngredients: Ingredient[] = [
      { key: 'ing.flour', grams: round(prefermentFlour, 1), percentage: pct(prefermentFlour), type: 'flour' },
      { key: 'ing.water', grams: round(prefermentWater, 1), percentage: pct(prefermentWater), type: 'water' },
    ];
    if (prefermentYeast > 0) {
      prefIngredients.push({
        key: YEAST_KEY[yeastForm],
        grams: round(prefermentYeast, 2),
        percentage: pct(prefermentYeast),
        type: 'yeast',
      });
    }
    if (prefermentSalt > 0) {
      prefIngredients.push({
        key: 'ing.salt',
        grams: round(prefermentSalt, 1),
        percentage: pct(prefermentSalt),
        type: 'salt',
      });
    }
    for (const extra of preferment.extras ?? []) {
      const grams = prefermentFlour * (extra.pct / 100);
      prefermentExtrasGrams += grams;
      prefIngredients.push({
        key: extra.key,
        grams: round(grams, 1),
        percentage: pct(grams),
        type: extra.type,
      });
    }
    sections.push({
      id: 'preferment',
      titleKey: `section.${preferment.type}`,
      meta: { hours: preferment.hours, tempC: preferment.temp_c, type: preferment.type },
      ingredients: prefIngredients.filter((i) => i.grams > 0.004),
      totalGrams: round(
        prefIngredients.reduce((sum, i) => sum + i.grams, 0),
        1,
      ),
    });
  }

  // Final dough
  const finalIngredients: Ingredient[] = [];

  // Flour, split across the blend. The preferment and levain draw from the
  // blend proportionally so the overall blend ratio is preserved.
  const blend = style.flourBlend;
  if (blend?.length) {
    for (const component of blend) {
      const grams = finalFlour * (component.percentage / 100);
      finalIngredients.push({
        key: component.key,
        grams: round(grams, 1),
        percentage: pct(grams),
        type: 'flour',
      });
    }
  } else {
    finalIngredients.push({
      key: 'ing.flour',
      grams: round(finalFlour, 1),
      percentage: pct(finalFlour),
      type: 'flour',
    });
  }

  // Liquids: plain water unless the style declares a split (milk, eggs…).
  let trueWater = 0;
  const liquids = style.liquids ?? [{ key: 'ing.water', share: 1, waterFraction: 1, type: 'water' as IngredientType }];
  for (const liquid of liquids) {
    const grams = finalWater * liquid.share;
    trueWater += grams * liquid.waterFraction;
    finalIngredients.push({
      key: liquid.key,
      grams: round(grams, 1),
      percentage: pct(grams),
      type: liquid.type,
    });
  }
  trueWater += prefermentWater + levainWater;

  const saltGrams = totalFlour * saltFrac - prefermentSalt;
  finalIngredients.push({
    key: 'ing.salt',
    grams: round(saltGrams, 1),
    percentage: pct(saltGrams),
    type: 'salt',
  });

  if (usesLevain && levainTotal > 0) {
    finalIngredients.push({
      key: 'ing.levain_ripe',
      grams: round(levainTotal, 1),
      percentage: pct(levainTotal),
      type: 'starter',
    });
  }

  if (dose.pct > 0) {
    finalIngredients.push({
      key: YEAST_KEY[yeastForm],
      grams: round(totalFlour * (dose.pct / 100), 2),
      percentage: pct(totalFlour * (dose.pct / 100)),
      type: 'yeast',
    });
  }

  if (preferment) {
    // A pointer to the preferment section, not a separate ingredient: it carries
    // the whole weight so the final-dough total adds up, and the same weight
    // drives its percentage so grams and % never disagree.
    const prefermentTotal =
      prefermentFlour + prefermentWater + prefermentYeast + prefermentSalt + prefermentExtrasGrams;
    finalIngredients.push({
      key: `ing.${preferment.type}_all`,
      grams: round(prefermentTotal, 1),
      percentage: pct(prefermentTotal),
      type: 'other',
      note: 'note.from_section',
    });
  }

  if (sugar > 0) {
    const grams = totalFlour * sugarFrac;
    finalIngredients.push({
      key: style.defaultParams.sugarKey ?? 'ing.sugar',
      grams: round(grams, 1),
      percentage: pct(grams),
      type: 'sugar',
    });
  }

  if (fat > 0) {
    const grams = totalFlour * fatFrac;
    finalIngredients.push({
      key: style.defaultParams.fatKey ?? 'ing.oil',
      grams: round(grams, 1),
      percentage: pct(grams),
      type: 'fat',
    });
  }

  for (const extra of extras) {
    const grams = totalFlour * basisShare * (extra.pct / 100);
    trueWater += grams * (extra.waterFraction ?? 0);
    finalIngredients.push({
      key: extra.key,
      grams: round(grams, 1),
      percentage: pct(grams),
      type: extra.type,
    });
  }

  // Drop zero-weight lines: a 100% biga leaves no fresh flour in the final dough,
  // and "0 g bread flour" is noise on a bake sheet.
  const finalLines = finalIngredients.filter((i) => i.grams > 0.004);

  sections.push({
    id: 'final',
    titleKey: 'section.final',
    ingredients: finalLines,
    totalGrams: round(
      finalLines.reduce((sum, i) => sum + i.grams, 0),
      1,
    ),
  });

  // ── 6. Water temperature ──
  const frictionC = FRICTION_FACTOR_C[mixing];
  const { rawTempC, factors } = computeWaterTemp({
    desiredDoughTempC: desiredDoughTemp,
    flourTempC: flourTemp,
    roomTempC: roomTemp,
    frictionC,
    prefermentTempC: preferment ? preferment.temp_c : undefined,
  });
  const waterTempC = clamp(rawTempC, WATER_TEMP_MIN_C, WATER_TEMP_MAX_C);
  const clampedWater = Math.abs(rawTempC - waterTempC) > 0.05;
  const iceGrams = computeIceSplit(finalWater, waterTempC);

  // ── 7. Bulk / proof split ──
  const ratioSum =
    style.fermentation.bulk_ratio + style.fermentation.proof_ratio || 1;
  let bulkHours = requestedTotal * (style.fermentation.bulk_ratio / ratioSum);
  let proofHours = requestedTotal * (style.fermentation.proof_ratio / ratioSum);

  // The style ratio decides how the schedule is divided, but it does not know
  // the temperature. A shaped loaf left warm for six hours is over-proofed
  // whatever the ratio says, so the *warm* part of the proof is capped at the
  // measured proof time and the surplus goes back into bulk, where a dough can
  // safely spend it. Cold hours are exempt: a long retard is the whole point of
  // an overnight proof.
  const coldInProof = coldPhase === 'proof' ? Math.min(coldHours, proofHours) : 0;
  const warmProof = proofHours - coldInProof;
  const maxWarmProof = proofHoursAt(roomTemp) * correction;
  if (warmProof > maxWarmProof) {
    const surplus = warmProof - maxWarmProof;
    proofHours -= surplus;
    bulkHours += surplus;
  }

  // ── 8. Schedule ──
  const startTime = inputs.startTime ?? new Date();
  const { steps, readyAt } = buildSchedule({
    style,
    startTime,
    bulkHours,
    proofHours,
    coldHours,
    coldPhase,
    roomTempC: roomTemp,
    coldTempC: coldTemp,
    pieces,
    usePreferment: Boolean(preferment),
    prefermentHours: preferment?.hours,
    prefermentTempC: preferment?.temp_c,
    prefermentType: preferment?.type,
    usesLevain: usesLevain && levainTotal > 0,
    levainHours: levainPeakHours,
    levainTempC: roomTemp,
  });

  // ── 9. Notes ──
  const doughWeight = sections
    .filter((s) => s.id === 'final')
    .reduce((sum, s) => sum + s.totalGrams, 0);
  const trueHydrationPct = totalFlour > 0 ? round((trueWater / totalFlour) * 100, 1) : 0;

  notes.push(
    ...buildNotes({
      style,
      hydration,
      trueHydrationPct,
      salt,
      fat,
      waterTempC,
      rawTempC,
      clampedWater,
      iceGrams,
      dose,
      inoculationPct,
      starterHydration,
      leavenType,
      coldHours,
      coldPhase,
      roomEquivHours,
      totalTime: requestedTotal,
      roomTemp,
      coldTemp,
      driver,
      starterEquivalentPct: usesLevain ? leavenOnFlour : dose.starterEquivalentPct,
      totalFlour,
      basisFlour,
      percentBasis,
      levainTotal,
      levainOnFlourPct: levainOnFlourPct(inoculationPct, starterHydration),
      levainPeakHours,
      preferment: Boolean(preferment),
    }),
  );

  const mergedIngredients = mergeIngredients(sections);

  return {
    sections,
    ingredients: mergedIngredients,
    totals: {
      flour: round(totalFlour, 1),
      water: round(totalWater, 1),
      trueWater: round(trueWater, 1),
      trueHydrationPct,
      doughWeight: round(doughWeight, 1),
      targetDoughWeight: round(targetDoughWeight, 1),
      perPiece: round(doughWeight / pieces, 1),
      pieces,
    },
    water: {
      tempC: round(waterTempC, 1),
      rawTempC: round(rawTempC, 1),
      clamped: clampedWater,
      factors,
      frictionC,
      flourTempC: flourTemp,
      desiredDoughTempC: desiredDoughTemp,
      iceGrams,
    },
    fermentation: {
      bulkHours: round(bulkHours, 2),
      proofHours: round(proofHours, 2),
      coldHours: round(coldHours, 2),
      coldPhase,
      roomEquivHours: round(roomEquivHours, 2),
      totalHours: round(requestedTotal, 2),
      yeastPct: dose.pct,
      yeastForm,
      inoculationPct,
      starterPct: round(inoculationPct * (1 + starterHydration / 100), 1),
      // Recipes quote the levain against the flour it joins, not against the
      // total including the levain's own flour. Report both so a baker can
      // compare this recipe with any other they read.
      levainOnFlourPct: levainOnFlourPct(inoculationPct, starterHydration),
      levainPeakHours,
      levainSeedShare: LEVAIN_SEED_SHARE,
      driver,
      doublingHours: round(doublingHoursAt(roomTemp), 2),
      timeCorrection: round(correction, 3),
      starterEquivalentPct: usesLevain
        ? round(leavenOnFlour, 2)
        : dose.starterEquivalentPct,
      leavenType,
      roomTempC: roomTemp,
      coldTempC: coldTemp,
    },
    params: {
      hydration,
      salt,
      sugar,
      oil: fat,
      starterHydration,
      prefermentFlourPct: preferment?.flour_pct ?? 0,
      percentBasis,
      basisFlour: round(basisFlour, 1),
    },
    timeline: steps,
    notes,
    readyAt,
  };
}

/** Flatten the sections into one shopping list, summing duplicate ingredients. */
function mergeIngredients(sections: RecipeSection[]): Ingredient[] {
  const merged = new Map<string, Ingredient>();
  for (const section of sections) {
    for (const ing of section.ingredients) {
      // The "all of the poolish" line is a pointer to another section, not an
      // ingredient you buy; and the levain seed is already counted in its own flour.
      if (ing.note === 'note.from_section') continue;
      const existing = merged.get(ing.key);
      if (existing) {
        existing.grams = round(existing.grams + ing.grams, 2);
        existing.percentage = round(existing.percentage + ing.percentage, 2);
      } else {
        merged.set(ing.key, { ...ing });
      }
    }
  }
  return [...merged.values()].filter((i) => i.grams > 0.004);
}

interface NoteContext {
  style: BreadStyle;
  hydration: number;
  trueHydrationPct: number;
  salt: number;
  fat: number;
  waterTempC: number;
  rawTempC: number;
  clampedWater: boolean;
  iceGrams: number;
  dose: ReturnType<typeof computeYeastDose>;
  inoculationPct: number;
  starterHydration: number;
  leavenType: string;
  coldHours: number;
  coldPhase: 'bulk' | 'proof';
  roomEquivHours: number;
  totalTime: number;
  roomTemp: number;
  coldTemp: number;
  driver: 'time' | 'dose';
  starterEquivalentPct: number;
  totalFlour: number;
  basisFlour: number;
  percentBasis: 'total' | 'dough';
  levainTotal: number;
  levainOnFlourPct: number;
  levainPeakHours: number;
  preferment: boolean;
}

function buildNotes(c: NoteContext): Note[] {
  const notes: Note[] = [];

  if (c.clampedWater) {
    notes.push({
      code: 'note.water_clamped',
      severity: 'warn',
      values: { raw: round(c.rawTempC, 1), used: round(c.waterTempC, 1) },
    });
  }
  if (c.iceGrams > 0) {
    notes.push({
      code: 'note.use_ice',
      severity: 'tip',
      values: { grams: c.iceGrams, temp: round(c.waterTempC, 1) },
    });
  }
  if (c.waterTempC > YEAST_DANGER_TEMP_C) {
    notes.push({ code: 'note.water_hot', severity: 'warn', values: { limit: YEAST_DANGER_TEMP_C } });
  }

  if (c.coldHours > 0) {
    notes.push({
      code: 'note.cold_retard',
      severity: 'info',
      values: {
        cold: round(c.coldHours, 1),
        total: round(c.totalTime, 1),
        equiv: round(c.roomEquivHours, 1),
        coldTemp: c.coldTemp,
        phase: c.coldPhase,
      },
    });
  }

  if (c.dose.clamped && c.dose.pct > 0) {
    notes.push({
      code: 'note.yeast_clamped',
      severity: 'warn',
      values: { pct: c.dose.pct, grams: round(c.totalFlour * (c.dose.pct / 100), 2) },
    });
  }

  if (c.dose.pct > 0 && c.totalFlour * (c.dose.pct / 100) < 0.5) {
    notes.push({
      code: 'note.tiny_yeast',
      severity: 'tip',
      values: { grams: round(c.totalFlour * (c.dose.pct / 100), 2) },
    });
  }

  if (c.inoculationPct > 0) {
    notes.push({
      code: 'note.levain_ratio',
      severity: 'info',
      values: {
        inoculation: c.inoculationPct,
        starter: round(c.inoculationPct * (1 + c.starterHydration / 100), 1),
        onFlour: c.levainOnFlourPct,
        grams: round(c.levainTotal, 0),
        hydration: c.starterHydration,
      },
    });
    notes.push({
      code: 'note.levain_ripe',
      severity: 'tip',
      values: { hours: c.levainPeakHours, temp: round(c.roomTemp, 1) },
    });
  }
  // Near the floor the answer stops responding to the slider, which is the
  // honest signal that no weighable dose stretches this room that far.
  if (c.driver === 'time' && c.starterEquivalentPct <= LEAVEN_PCT_MIN * 1.5) {
    notes.push({
      code: 'note.time_too_long',
      severity: 'warn',
      values: { hours: round(c.totalTime, 1), temp: round(c.roomTemp, 1) },
    });
  }
  if (c.starterEquivalentPct >= VERY_FAST_LEAVEN_PCT) {
    notes.push({
      code: 'note.very_fast',
      severity: 'warn',
      values: { pct: round(c.starterEquivalentPct, 1) },
    });
  }
  if (c.inoculationPct >= INOCULATION_HIGH) {
    notes.push({ code: 'note.levain_high', severity: 'warn', values: { pct: c.inoculationPct } });
  }

  if (c.hydration > 78) {
    notes.push({ code: 'note.high_hydration', severity: 'tip', values: { pct: round(c.hydration, 1) } });
  }
  if (c.trueHydrationPct > 0 && Math.abs(c.trueHydrationPct - c.hydration) > 1) {
    notes.push({
      code: 'note.true_hydration',
      severity: 'info',
      values: { stated: round(c.hydration, 1), actual: c.trueHydrationPct },
    });
  }
  if (c.salt < 1.5) {
    notes.push({ code: 'note.low_salt', severity: 'warn', values: { pct: round(c.salt, 1) } });
  }
  if (c.salt > 3.2) {
    notes.push({ code: 'note.high_salt', severity: 'warn', values: { pct: round(c.salt, 1) } });
  }
  if (c.fat > 12) {
    notes.push({ code: 'note.rich_dough', severity: 'tip', values: { pct: round(c.fat, 1) } });
  }
  if (c.preferment) {
    notes.push({ code: 'note.preferment', severity: 'info' });
  }

  notes.push({
    code: c.percentBasis === 'dough' ? 'note.percent_basis_dough' : 'note.percent_basis_total',
    severity: 'info',
    values: { flour: round(c.basisFlour, 0), total: round(c.totalFlour, 0) },
  });

  return notes;
}
