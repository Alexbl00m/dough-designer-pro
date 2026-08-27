/**
 * Style database.
 *
 * Everything the engine needs to build a recipe lives here as data — there are
 * no per-style branches in the calculation code. Human-readable text
 * (description, region, characteristics, process step labels) lives in the i18n
 * dictionaries under the `style.<id>.*` and `process.*` key spaces, so the same
 * data serves every language.
 */

export type StyleCategory = 'pizza' | 'bread' | 'enriched' | 'preferment';
export type PrefermentType = 'poolish' | 'biga' | 'levain';
export type IngredientType =
  | 'flour'
  | 'water'
  | 'dairy'
  | 'salt'
  | 'yeast'
  | 'starter'
  | 'fat'
  | 'sugar'
  | 'egg'
  | 'other';

export interface FlourComponent {
  /** i18n key under `flour.*`; falls back to the raw string if no translation exists. */
  key: string;
  /** Share of the total flour weight, in percent. All components must sum to 100. */
  percentage: number;
  /** Protein content, used for the flour-strength advisor. */
  protein_pct?: number;
  ash_pct?: number;
}

/**
 * A liquid other than plain water, expressed as a share of the style's total
 * hydration. `waterFraction` is how much of its weight actually behaves as
 * water, which is what the true-hydration figure is built from.
 */
export interface LiquidComponent {
  key: string;
  /** Share of total hydration, 0–1. Shares must sum to 1. */
  share: number;
  /** Water content by weight. Milk ≈ 0.87, eggs ≈ 0.75, plain water 1. */
  waterFraction: number;
  type: IngredientType;
}

/** A dry or semi-dry addition expressed in baker's % of total flour. */
export interface StyleExtra {
  key: string;
  pct: number;
  type: IngredientType;
  /** Water contributed by this ingredient, as a fraction of its weight. */
  waterFraction?: number;
}

export interface PrefermentSpec {
  type: PrefermentType;
  /** Share of the TOTAL flour that is pre-fermented. */
  flour_pct: number;
  hydration_pct: number;
  /** Typical build time and temperature for the preferment itself. */
  hours: number;
  temp_c: number;
  /** Fresh yeast as % of the preferment's own flour (poolish/biga). */
  yeast_fresh_pct?: number;
  /** Starter flour as % of the preferment's own flour (levain). */
  inoculation_pct?: number;
  /** Some bigas carry a little salt to slow them down. */
  salt_pct?: number;
  /** Extras that belong in the preferment rather than the final dough, e.g. honey in a poolish. */
  extras?: StyleExtra[];
}

export interface FoldSpec {
  count: number;
  intervalMin: number;
  /** i18n key under `process.fold.*` */
  techniqueKey: string;
}

/** Everything the schedule builder needs to lay out a timeline for this style. */
export interface ProcessSpec {
  autolyseMin?: number;
  mixMin: number;
  /** Rest between mixing and the first fold. */
  benchRestMin?: number;
  folds?: FoldSpec;
  /** Rest between pre-shape and final shape. */
  preshapeRestMin?: number;
  /** i18n key under `process.shape.*` */
  shapeKey: string;
  /** i18n key under `process.bake.*` */
  bakeKey: string;
  bakeTempC: number;
  /** Some breads start hot and drop; omitted when the temperature is constant. */
  bakeDropTempC?: number;
  bakeMinutes: number;
  steamMinutes?: number;
  /** Where a cold retard naturally sits for this style. */
  coldPhase: 'bulk' | 'proof';
}

export interface StyleDefaults {
  ballWeight: number;
  ballCount: number;
  /** Default fermentation time in hours (bulk + final proof, excluding preferment). */
  totalTime: number;
  coldHours: number;
  roomTemp: number;
  doughTemp: number;
  leavenType: 'commercial' | 'sourdough' | 'hybrid';
}

export interface BreadStyle {
  id: string;
  /** Proper noun — deliberately not translated. */
  name: string;
  category: StyleCategory;
  /** i18n key under `region.*` */
  regionKey: string;
  defaultParams: {
    hydration_pct: number;
    salt_pct: number;
    sugar_pct: number;
    /** Fat: oil or butter, depending on the style's `fatKey`. */
    oil_pct: number;
    fatKey?: string;
    sugarKey?: string;
  };
  fermentation: {
    /** How the total is split between bulk and final proof. Normalised to sum to 1. */
    bulk_ratio: number;
    proof_ratio: number;
  };
  /**
   * Scales the whole fermentation clock for this style.
   *
   * The measured curve fixes the *shape* of fermentation — logarithmic in dose,
   * non-Arrhenius in temperature — but not its absolute level, which varies
   * with how far a baker pushes bulk and how lively their starter is. Full
   * Proof Baking's 6 h bulk at 20% levain runs about 1.75× the table's, because
   * they stop at only 50–60% rise. Default 1; set it where a published recipe
   * pins the level.
   */
  fermentFactor?: number;
  /** Starting levain dose (ripe levain over dough flour) when driving by dose. */
  defaultLevainPct?: number;
  preferment?: PrefermentSpec;
  process: ProcessSpec;
  defaults: StyleDefaults;
  flourBlend?: FlourComponent[];
  liquids?: LiquidComponent[];
  extras?: StyleExtra[];
  /** Minimum flour strength this style really wants, in % protein. */
  minProteinPct?: number;
  /**
   * Volume increase to look for at the end of bulk, as [min, max] percent.
   * Sources disagree because they push bulk to different points — Full Proof
   * Baking aims for 50–60%, Russell Peace Baker for 30–50% — so it is a
   * property of the style, not a constant.
   */
  bulkRisePct?: [number, number];
  /** Number of i18n'd characteristic bullets in `style.<id>.char.<n>`. */
  characteristicCount: number;
}

const WHEAT: FlourComponent[] = [{ key: 'flour.bread', percentage: 100, protein_pct: 12 }];

export const BREAD_STYLES: BreadStyle[] = [
  // ─────────────────────────── PIZZA ───────────────────────────
  {
    id: 'neapolitan',
    name: 'Pizza Napoletana',
    category: 'pizza',
    regionKey: 'region.napoli',
    defaultParams: { hydration_pct: 62, salt_pct: 2.8, sugar_pct: 0, oil_pct: 0 },
    fermentation: {
      bulk_ratio: 0.75,
      proof_ratio: 0.25,
    },
    defaultLevainPct: 15.1,
    process: {
      mixMin: 20,
      benchRestMin: 20,
      folds: { count: 3, intervalMin: 15, techniqueKey: 'process.fold.slapfold' },
      shapeKey: 'process.shape.balls',
      bakeKey: 'process.bake.neapolitan',
      bakeTempC: 450,
      bakeMinutes: 2,
      coldPhase: 'bulk',
    },
    defaults: {
      ballWeight: 265,
      ballCount: 4,
      totalTime: 24,
      coldHours: 0,
      roomTemp: 21,
      doughTemp: 23,
      leavenType: 'commercial',
    },
    flourBlend: [
      { key: 'flour.caputo_pizzeria', percentage: 50, protein_pct: 12.5 },
      { key: 'flour.vigevano_oro', percentage: 50, protein_pct: 13 },
    ],
    minProteinPct: 12,
    characteristicCount: 4,
  },
  {
    id: 'ny_style',
    name: 'New York Style Pizza',
    category: 'pizza',
    regionKey: 'region.newyork',
    defaultParams: { hydration_pct: 63, salt_pct: 2.2, sugar_pct: 1.5, oil_pct: 2, fatKey: 'ing.oliveoil' },
    fermentation: {
      bulk_ratio: 0.25,
      proof_ratio: 0.75,
    },
    defaultLevainPct: 17.4,
    process: {
      mixMin: 10,
      benchRestMin: 20,
      shapeKey: 'process.shape.balls',
      bakeKey: 'process.bake.steel',
      bakeTempC: 285,
      bakeMinutes: 8,
      coldPhase: 'proof',
    },
    defaults: {
      ballWeight: 280,
      ballCount: 4,
      totalTime: 48,
      coldHours: 44,
      roomTemp: 21,
      doughTemp: 24,
      leavenType: 'commercial',
    },
    flourBlend: [{ key: 'flour.bread_high', percentage: 100, protein_pct: 13.5 }],
    minProteinPct: 12.5,
    characteristicCount: 4,
  },
  {
    id: 'detroit',
    name: 'Detroit Style Pizza',
    category: 'pizza',
    regionKey: 'region.detroit',
    defaultParams: { hydration_pct: 72, salt_pct: 2.2, sugar_pct: 1, oil_pct: 4, fatKey: 'ing.oliveoil' },
    fermentation: {
      bulk_ratio: 0.6,
      proof_ratio: 0.4,
    },
    process: {
      mixMin: 8,
      benchRestMin: 30,
      folds: { count: 2, intervalMin: 30, techniqueKey: 'process.fold.coil' },
      shapeKey: 'process.shape.pan',
      bakeKey: 'process.bake.pan',
      bakeTempC: 260,
      bakeMinutes: 14,
      coldPhase: 'bulk',
    },
    defaults: {
      ballWeight: 560,
      ballCount: 1,
      totalTime: 24,
      coldHours: 18,
      roomTemp: 21,
      doughTemp: 25,
      leavenType: 'commercial',
    },
    flourBlend: [{ key: 'flour.bread_high', percentage: 100, protein_pct: 13.5 }],
    minProteinPct: 12.5,
    characteristicCount: 4,
  },
  {
    id: 'roman',
    name: 'Pizza in Teglia (Romana)',
    category: 'pizza',
    regionKey: 'region.rome',
    defaultParams: { hydration_pct: 80, salt_pct: 2.4, sugar_pct: 0, oil_pct: 3, fatKey: 'ing.oliveoil' },
    fermentation: {
      bulk_ratio: 0.7,
      proof_ratio: 0.3,
    },
    process: {
      autolyseMin: 30,
      mixMin: 10,
      benchRestMin: 30,
      folds: { count: 3, intervalMin: 30, techniqueKey: 'process.fold.coil' },
      shapeKey: 'process.shape.tray',
      bakeKey: 'process.bake.tray',
      bakeTempC: 250,
      bakeMinutes: 16,
      coldPhase: 'bulk',
    },
    defaults: {
      ballWeight: 800,
      ballCount: 1,
      totalTime: 26,
      coldHours: 20,
      roomTemp: 20,
      doughTemp: 24,
      leavenType: 'commercial',
    },
    flourBlend: [{ key: 'flour.tipo1', percentage: 100, protein_pct: 13.5 }],
    minProteinPct: 13,
    characteristicCount: 4,
  },
  {
    id: 'chicago_deep',
    name: 'Chicago Deep Dish',
    category: 'pizza',
    regionKey: 'region.chicago',
    defaultParams: { hydration_pct: 52, salt_pct: 1.8, sugar_pct: 2, oil_pct: 18, fatKey: 'ing.butter' },
    fermentation: {
      bulk_ratio: 0.65,
      proof_ratio: 0.35,
    },
    process: {
      mixMin: 6,
      shapeKey: 'process.shape.deepdish',
      bakeKey: 'process.bake.deepdish',
      bakeTempC: 220,
      bakeMinutes: 32,
      coldPhase: 'bulk',
    },
    defaults: {
      ballWeight: 620,
      ballCount: 1,
      totalTime: 5,
      coldHours: 0,
      roomTemp: 22,
      doughTemp: 24,
      leavenType: 'commercial',
    },
    flourBlend: [
      { key: 'flour.ap', percentage: 80, protein_pct: 10.5 },
      { key: 'flour.semolina', percentage: 20, protein_pct: 12.5 },
    ],
    characteristicCount: 4,
  },
  {
    id: 'sicilian_pizza',
    name: 'Sfincione Siciliano',
    category: 'pizza',
    regionKey: 'region.sicily',
    defaultParams: { hydration_pct: 75, salt_pct: 2.4, sugar_pct: 1, oil_pct: 6, fatKey: 'ing.oliveoil' },
    fermentation: {
      bulk_ratio: 0.6,
      proof_ratio: 0.4,
    },
    defaultLevainPct: 22.2,
    process: {
      mixMin: 10,
      benchRestMin: 30,
      folds: { count: 2, intervalMin: 40, techniqueKey: 'process.fold.coil' },
      shapeKey: 'process.shape.tray',
      bakeKey: 'process.bake.tray',
      bakeTempC: 240,
      bakeMinutes: 22,
      coldPhase: 'bulk',
    },
    defaults: {
      ballWeight: 900,
      ballCount: 1,
      totalTime: 7,
      coldHours: 0,
      roomTemp: 22,
      doughTemp: 25,
      leavenType: 'commercial',
    },
    flourBlend: [
      { key: 'flour.tipo00', percentage: 60, protein_pct: 11 },
      { key: 'flour.semolina', percentage: 40, protein_pct: 13.5 },
    ],
    characteristicCount: 4,
  },

  // ──────────────────── PIZZA WITH PREFERMENT ────────────────────
  {
    id: 'pizza_poolish',
    name: 'Pizza con Poolish',
    category: 'preferment',
    regionKey: 'region.napoli',
    defaultParams: { hydration_pct: 65, salt_pct: 2.4, sugar_pct: 0.6, oil_pct: 0, sugarKey: 'ing.honey' },
    fermentation: {
      bulk_ratio: 0.35,
      proof_ratio: 0.65,
    },
    preferment: {
      type: 'poolish',
      flour_pct: 35,
      hydration_pct: 100,
      hours: 16,
      temp_c: 18,
      yeast_fresh_pct: 0.6,
      extras: [{ key: 'ing.honey', pct: 1.7, type: 'sugar' }],
    },
    process: {
      mixMin: 12,
      benchRestMin: 20,
      folds: { count: 2, intervalMin: 30, techniqueKey: 'process.fold.slapfold' },
      shapeKey: 'process.shape.balls',
      bakeKey: 'process.bake.neapolitan',
      bakeTempC: 430,
      bakeMinutes: 2,
      coldPhase: 'proof',
    },
    defaults: {
      ballWeight: 270,
      ballCount: 4,
      totalTime: 6,
      coldHours: 0,
      roomTemp: 22,
      doughTemp: 24,
      leavenType: 'commercial',
    },
    flourBlend: [{ key: 'flour.tipo00', percentage: 100, protein_pct: 12.5 }],
    minProteinPct: 12,
    characteristicCount: 4,
  },
  {
    id: 'pizza_biga',
    name: 'Pizza 100% Biga',
    category: 'preferment',
    regionKey: 'region.napoli',
    defaultParams: { hydration_pct: 70, salt_pct: 2.8, sugar_pct: 1, oil_pct: 0, sugarKey: 'ing.malt' },
    fermentation: {
      bulk_ratio: 0.25,
      proof_ratio: 0.75,
    },
    preferment: {
      type: 'biga',
      flour_pct: 100,
      hydration_pct: 47,
      hours: 18,
      temp_c: 16,
      yeast_fresh_pct: 0.25,
    },
    process: {
      mixMin: 18,
      benchRestMin: 30,
      shapeKey: 'process.shape.balls',
      bakeKey: 'process.bake.neapolitan',
      bakeTempC: 430,
      bakeMinutes: 2,
      coldPhase: 'proof',
    },
    defaults: {
      ballWeight: 270,
      ballCount: 4,
      totalTime: 5,
      coldHours: 0,
      roomTemp: 20,
      doughTemp: 24,
      leavenType: 'commercial',
    },
    flourBlend: [
      { key: 'flour.pizzuti', percentage: 60, protein_pct: 13 },
      { key: 'flour.vigevano_tramonti', percentage: 40, protein_pct: 14 },
    ],
    minProteinPct: 13,
    characteristicCount: 4,
  },
  {
    id: 'poolish_bread',
    name: 'Pain au Poolish',
    category: 'preferment',
    regionKey: 'region.france',
    defaultParams: { hydration_pct: 74, salt_pct: 2, sugar_pct: 0, oil_pct: 0 },
    fermentation: {
      bulk_ratio: 0.6,
      proof_ratio: 0.4,
    },
    preferment: {
      type: 'poolish',
      flour_pct: 50,
      hydration_pct: 100,
      hours: 14,
      temp_c: 19,
      yeast_fresh_pct: 0.3,
    },
    process: {
      autolyseMin: 30,
      mixMin: 8,
      benchRestMin: 30,
      folds: { count: 3, intervalMin: 40, techniqueKey: 'process.fold.stretchfold' },
      preshapeRestMin: 25,
      shapeKey: 'process.shape.batard',
      bakeKey: 'process.bake.dutchoven',
      bakeTempC: 250,
      bakeDropTempC: 225,
      bakeMinutes: 40,
      steamMinutes: 20,
      coldPhase: 'proof',
    },
    defaults: {
      ballWeight: 900,
      ballCount: 2,
      totalTime: 5,
      coldHours: 0,
      roomTemp: 23,
      doughTemp: 25,
      leavenType: 'commercial',
    },
    flourBlend: [
      { key: 'flour.bread', percentage: 80, protein_pct: 12.5 },
      { key: 'flour.wholewheat', percentage: 20, protein_pct: 14 },
    ],
    characteristicCount: 4,
  },
  {
    id: 'biga_pane',
    name: 'Pane Pugliese',
    category: 'preferment',
    regionKey: 'region.puglia',
    defaultParams: { hydration_pct: 72, salt_pct: 2.2, sugar_pct: 0, oil_pct: 0 },
    fermentation: {
      bulk_ratio: 0.65,
      proof_ratio: 0.35,
    },
    preferment: {
      type: 'biga',
      flour_pct: 60,
      hydration_pct: 45,
      hours: 16,
      temp_c: 18,
      yeast_fresh_pct: 0.2,
    },
    process: {
      mixMin: 12,
      benchRestMin: 30,
      folds: { count: 3, intervalMin: 40, techniqueKey: 'process.fold.coil' },
      preshapeRestMin: 25,
      shapeKey: 'process.shape.boule',
      bakeKey: 'process.bake.dutchoven',
      bakeTempC: 250,
      bakeDropTempC: 220,
      bakeMinutes: 45,
      steamMinutes: 20,
      coldPhase: 'proof',
    },
    defaults: {
      ballWeight: 900,
      ballCount: 2,
      totalTime: 5,
      coldHours: 0,
      roomTemp: 22,
      doughTemp: 25,
      leavenType: 'commercial',
    },
    flourBlend: [
      { key: 'flour.tipo0', percentage: 70, protein_pct: 11.5 },
      { key: 'flour.tipo1', percentage: 30, protein_pct: 12 },
    ],
    characteristicCount: 4,
  },
  {
    id: 'baguette',
    name: 'Baguette de Tradition',
    category: 'preferment',
    regionKey: 'region.france',
    defaultParams: { hydration_pct: 72, salt_pct: 2, sugar_pct: 0, oil_pct: 0 },
    fermentation: {
      bulk_ratio: 0.6,
      proof_ratio: 0.4,
    },
    preferment: {
      type: 'poolish',
      flour_pct: 40,
      hydration_pct: 100,
      hours: 14,
      temp_c: 19,
      yeast_fresh_pct: 0.3,
    },
    process: {
      autolyseMin: 40,
      mixMin: 6,
      benchRestMin: 45,
      folds: { count: 2, intervalMin: 45, techniqueKey: 'process.fold.letterfold' },
      preshapeRestMin: 25,
      shapeKey: 'process.shape.baguette',
      bakeKey: 'process.bake.steam',
      bakeTempC: 250,
      bakeDropTempC: 235,
      bakeMinutes: 22,
      steamMinutes: 12,
      coldPhase: 'proof',
    },
    defaults: {
      ballWeight: 350,
      ballCount: 4,
      totalTime: 4,
      coldHours: 0,
      roomTemp: 23,
      doughTemp: 24,
      leavenType: 'commercial',
    },
    flourBlend: [{ key: 'flour.t65', percentage: 100, protein_pct: 11.5 }],
    characteristicCount: 4,
  },
  {
    id: 'ciabatta',
    name: 'Ciabatta',
    category: 'preferment',
    regionKey: 'region.italy',
    defaultParams: { hydration_pct: 82, salt_pct: 2.2, sugar_pct: 0, oil_pct: 1, fatKey: 'ing.oliveoil' },
    fermentation: {
      bulk_ratio: 0.7,
      proof_ratio: 0.3,
    },
    preferment: {
      type: 'biga',
      flour_pct: 50,
      hydration_pct: 45,
      hours: 16,
      temp_c: 18,
      yeast_fresh_pct: 0.2,
    },
    process: {
      mixMin: 12,
      benchRestMin: 30,
      folds: { count: 3, intervalMin: 30, techniqueKey: 'process.fold.coil' },
      shapeKey: 'process.shape.ciabatta',
      bakeKey: 'process.bake.steam',
      bakeTempC: 240,
      bakeMinutes: 25,
      steamMinutes: 12,
      coldPhase: 'bulk',
    },
    defaults: {
      ballWeight: 450,
      ballCount: 2,
      totalTime: 4,
      coldHours: 0,
      roomTemp: 22,
      doughTemp: 25,
      leavenType: 'commercial',
    },
    flourBlend: [{ key: 'flour.tipo0', percentage: 100, protein_pct: 12.5 }],
    minProteinPct: 12,
    characteristicCount: 4,
  },

  // ─────────────────────────── BREAD ───────────────────────────
  {
    id: 'strong_white_sourdough',
    name: 'Strong White Sourdough',
    category: 'bread',
    regionKey: 'region.uk',
    defaultParams: { hydration_pct: 70.5, salt_pct: 1.8, sugar_pct: 0, oil_pct: 0 },
    fermentation: {
      bulk_ratio: 0.7,
      proof_ratio: 0.3,
      // 80 g of 100%-hydration starter on 400 g of dough flour is 40 g of
      // starter flour in 440 g total — 9.1% in the engine's convention — over a
    },
    defaultLevainPct: 19.8,
    // Solved so the engine reproduces The Mighty White's 80 g starter on 400 g
    // of dough flour over its same-day schedule at 27 °C.
    fermentFactor: 1.37,
    process: {
      autolyseMin: 45,
      mixMin: 3,
      benchRestMin: 30,
      folds: { count: 4, intervalMin: 40, techniqueKey: 'process.fold.coil' },
      preshapeRestMin: 20,
      shapeKey: 'process.shape.boule',
      bakeKey: 'process.bake.dutchoven',
      bakeTempC: 240,
      bakeDropTempC: 220,
      bakeMinutes: 43,
      steamMinutes: 20,
      coldPhase: 'proof',
    },
    defaults: {
      ballWeight: 758,
      ballCount: 1,
      totalTime: 7,
      coldHours: 0,
      roomTemp: 27,
      doughTemp: 28,
      leavenType: 'sourdough',
    },
    flourBlend: [{ key: 'flour.bread_high', percentage: 100, protein_pct: 12.7 }],
    minProteinPct: 12,
    bulkRisePct: [30, 50],
    characteristicCount: 4,
  },
  {
    id: 'country_sourdough',
    name: 'Pain de Campagne',
    category: 'bread',
    regionKey: 'region.france',
    defaultParams: { hydration_pct: 76, salt_pct: 2, sugar_pct: 0, oil_pct: 0 },
    fermentation: {
      bulk_ratio: 0.55,
      proof_ratio: 0.45,
    },
    defaultLevainPct: 19.8,
    // Solved so the engine reproduces Full Proof Baking's 20% levain over their
    // published 6 h bulk at 23.3 °C plus a 14 h retard at 3.3 °C.
    fermentFactor: 1.53,
    process: {
      autolyseMin: 45,
      mixMin: 10,
      benchRestMin: 30,
      folds: { count: 4, intervalMin: 30, techniqueKey: 'process.fold.stretchfold' },
      preshapeRestMin: 25,
      shapeKey: 'process.shape.boule',
      bakeKey: 'process.bake.dutchoven',
      bakeTempC: 250,
      bakeDropTempC: 225,
      bakeMinutes: 45,
      steamMinutes: 20,
      coldPhase: 'proof',
    },
    defaults: {
      ballWeight: 900,
      ballCount: 2,
      totalTime: 18,
      coldHours: 12,
      roomTemp: 24,
      doughTemp: 25,
      leavenType: 'sourdough',
    },
    flourBlend: [
      { key: 'flour.bread', percentage: 85, protein_pct: 12.5 },
      { key: 'flour.wholewheat', percentage: 10, protein_pct: 14 },
      { key: 'flour.rye', percentage: 5, protein_pct: 8 },
    ],
    characteristicCount: 4,
  },
  {
    id: 'focaccia',
    name: 'Focaccia Genovese',
    category: 'bread',
    regionKey: 'region.genoa',
    defaultParams: { hydration_pct: 80, salt_pct: 2.2, sugar_pct: 0.5, oil_pct: 8, fatKey: 'ing.oliveoil' },
    fermentation: {
      bulk_ratio: 0.55,
      proof_ratio: 0.45,
    },
    defaultLevainPct: 22.2,
    process: {
      mixMin: 8,
      benchRestMin: 30,
      folds: { count: 3, intervalMin: 30, techniqueKey: 'process.fold.coil' },
      shapeKey: 'process.shape.tray',
      bakeKey: 'process.bake.focaccia',
      bakeTempC: 230,
      bakeMinutes: 22,
      coldPhase: 'bulk',
    },
    defaults: {
      ballWeight: 900,
      ballCount: 1,
      totalTime: 6,
      coldHours: 0,
      roomTemp: 22,
      doughTemp: 25,
      leavenType: 'commercial',
    },
    flourBlend: [{ key: 'flour.tipo0', percentage: 100, protein_pct: 12 }],
    characteristicCount: 4,
  },
  {
    id: 'pain_de_mie',
    name: 'Pain de Mie',
    category: 'bread',
    regionKey: 'region.france',
    defaultParams: { hydration_pct: 66, salt_pct: 1.8, sugar_pct: 3, oil_pct: 5, fatKey: 'ing.butter' },
    fermentation: {
      bulk_ratio: 0.45,
      proof_ratio: 0.55,
    },
    process: {
      mixMin: 12,
      shapeKey: 'process.shape.pullman',
      bakeKey: 'process.bake.pullman',
      bakeTempC: 200,
      bakeMinutes: 35,
      coldPhase: 'bulk',
    },
    defaults: {
      ballWeight: 800,
      ballCount: 1,
      totalTime: 3,
      coldHours: 0,
      roomTemp: 23,
      doughTemp: 25,
      leavenType: 'commercial',
    },
    liquids: [
      { key: 'ing.water', share: 0.5, waterFraction: 1, type: 'water' },
      { key: 'ing.milk', share: 0.5, waterFraction: 0.87, type: 'dairy' },
    ],
    flourBlend: WHEAT,
    characteristicCount: 4,
  },
  {
    id: 'pita',
    name: 'Pita',
    category: 'bread',
    regionKey: 'region.levant',
    defaultParams: { hydration_pct: 62, salt_pct: 2, sugar_pct: 1, oil_pct: 3, fatKey: 'ing.oliveoil' },
    fermentation: {
      bulk_ratio: 0.7,
      proof_ratio: 0.3,
    },
    process: {
      mixMin: 8,
      shapeKey: 'process.shape.discs',
      bakeKey: 'process.bake.pita',
      bakeTempC: 275,
      bakeMinutes: 4,
      coldPhase: 'bulk',
    },
    defaults: {
      ballWeight: 90,
      ballCount: 8,
      totalTime: 3,
      coldHours: 0,
      roomTemp: 24,
      doughTemp: 26,
      leavenType: 'commercial',
    },
    flourBlend: WHEAT,
    characteristicCount: 4,
  },
  {
    id: 'sourdough_rye',
    name: 'Rågsurdegsbröd',
    category: 'bread',
    regionKey: 'region.sweden',
    defaultParams: { hydration_pct: 78, salt_pct: 2, sugar_pct: 0, oil_pct: 0 },
    fermentation: {
      bulk_ratio: 0.6,
      proof_ratio: 0.4,
    },
    defaultLevainPct: 32.6,
    process: {
      mixMin: 8,
      benchRestMin: 40,
      folds: { count: 2, intervalMin: 45, techniqueKey: 'process.fold.coil' },
      shapeKey: 'process.shape.tin',
      bakeKey: 'process.bake.rye',
      bakeTempC: 250,
      bakeDropTempC: 200,
      bakeMinutes: 55,
      steamMinutes: 15,
      coldPhase: 'proof',
    },
    defaults: {
      ballWeight: 900,
      ballCount: 1,
      totalTime: 14,
      coldHours: 8,
      roomTemp: 24,
      doughTemp: 27,
      leavenType: 'sourdough',
    },
    flourBlend: [
      { key: 'flour.rye', percentage: 40, protein_pct: 8 },
      { key: 'flour.bread', percentage: 60, protein_pct: 12.5 },
    ],
    characteristicCount: 4,
  },
  {
    id: 'multigrain_sourdough',
    name: 'Multigrain Sourdough',
    category: 'bread',
    regionKey: 'region.nordic',
    defaultParams: { hydration_pct: 82, salt_pct: 2, sugar_pct: 0, oil_pct: 0 },
    fermentation: {
      bulk_ratio: 0.55,
      proof_ratio: 0.45,
    },
    defaultLevainPct: 22.2,
    process: {
      autolyseMin: 45,
      mixMin: 10,
      benchRestMin: 30,
      folds: { count: 4, intervalMin: 30, techniqueKey: 'process.fold.stretchfold' },
      preshapeRestMin: 25,
      shapeKey: 'process.shape.batard',
      bakeKey: 'process.bake.dutchoven',
      bakeTempC: 250,
      bakeDropTempC: 225,
      bakeMinutes: 45,
      steamMinutes: 20,
      coldPhase: 'proof',
    },
    defaults: {
      ballWeight: 900,
      ballCount: 2,
      totalTime: 18,
      coldHours: 12,
      roomTemp: 24,
      doughTemp: 26,
      leavenType: 'sourdough',
    },
    flourBlend: [
      { key: 'flour.bread', percentage: 50, protein_pct: 12.5 },
      { key: 'flour.rye', percentage: 20, protein_pct: 8 },
      { key: 'flour.spelt', percentage: 30, protein_pct: 14 },
    ],
    extras: [{ key: 'ing.seeds_soaker', pct: 12, type: 'other', waterFraction: 0.5 }],
    characteristicCount: 4,
  },
  {
    id: 'sourdough_form_bread',
    name: 'Surdeg Formbröd',
    category: 'bread',
    regionKey: 'region.sweden',
    defaultParams: { hydration_pct: 68, salt_pct: 2.2, sugar_pct: 0, oil_pct: 0 },
    fermentation: {
      bulk_ratio: 0.65,
      proof_ratio: 0.35,
    },
    defaultLevainPct: 50.0,
    process: {
      mixMin: 8,
      benchRestMin: 30,
      folds: { count: 3, intervalMin: 30, techniqueKey: 'process.fold.bowlfold' },
      shapeKey: 'process.shape.tin',
      bakeKey: 'process.bake.tin',
      bakeTempC: 230,
      bakeDropTempC: 200,
      bakeMinutes: 40,
      steamMinutes: 15,
      coldPhase: 'proof',
    },
    defaults: {
      ballWeight: 750,
      ballCount: 1,
      totalTime: 6,
      coldHours: 0,
      roomTemp: 23,
      doughTemp: 25,
      leavenType: 'sourdough',
    },
    flourBlend: [{ key: 'flour.bread', percentage: 100, protein_pct: 12 }],
    characteristicCount: 4,
  },
  {
    id: 'sourdough_tortillas',
    name: 'Surdegstortillas',
    category: 'bread',
    regionKey: 'region.mexico',
    defaultParams: { hydration_pct: 58, salt_pct: 2, sugar_pct: 0, oil_pct: 18, fatKey: 'ing.melted_butter' },
    fermentation: {
      bulk_ratio: 0.8,
      proof_ratio: 0.2,
    },
    defaultLevainPct: 17.4,
    process: {
      mixMin: 8,
      shapeKey: 'process.shape.tortilla',
      bakeKey: 'process.bake.skillet',
      bakeTempC: 230,
      bakeMinutes: 1,
      coldPhase: 'bulk',
    },
    defaults: {
      ballWeight: 70,
      ballCount: 12,
      totalTime: 3,
      coldHours: 0,
      roomTemp: 23,
      doughTemp: 28,
      leavenType: 'sourdough',
    },
    flourBlend: WHEAT,
    characteristicCount: 4,
  },

  // ────────────────────────── ENRICHED ──────────────────────────
  {
    id: 'milkbread',
    name: 'Hokkaido Milk Bread',
    category: 'enriched',
    regionKey: 'region.japan',
    defaultParams: { hydration_pct: 68, salt_pct: 1.6, sugar_pct: 10, oil_pct: 8, fatKey: 'ing.butter' },
    fermentation: {
      bulk_ratio: 0.55,
      proof_ratio: 0.45,
    },
    process: {
      mixMin: 15,
      shapeKey: 'process.shape.rolls',
      bakeKey: 'process.bake.enriched',
      bakeTempC: 180,
      bakeMinutes: 30,
      coldPhase: 'bulk',
    },
    defaults: {
      ballWeight: 900,
      ballCount: 1,
      totalTime: 3,
      coldHours: 0,
      roomTemp: 24,
      doughTemp: 26,
      leavenType: 'commercial',
    },
    liquids: [
      { key: 'ing.milk', share: 0.75, waterFraction: 0.87, type: 'dairy' },
      { key: 'ing.water', share: 0.25, waterFraction: 1, type: 'water' },
    ],
    extras: [{ key: 'ing.milk_powder', pct: 4.6, type: 'dairy' }],
    flourBlend: [{ key: 'flour.bread', percentage: 100, protein_pct: 12.5 }],
    characteristicCount: 4,
  },
  {
    id: 'pain_de_mie_traditional',
    name: 'Pain de Mie Traditionnel',
    category: 'enriched',
    regionKey: 'region.france',
    defaultParams: { hydration_pct: 69, salt_pct: 2.1, sugar_pct: 2.6, oil_pct: 14, fatKey: 'ing.butter', sugarKey: 'ing.honey' },
    fermentation: {
      bulk_ratio: 0.45,
      proof_ratio: 0.55,
    },
    process: {
      mixMin: 15,
      shapeKey: 'process.shape.pullman',
      bakeKey: 'process.bake.pullman',
      bakeTempC: 220,
      bakeDropTempC: 190,
      bakeMinutes: 35,
      coldPhase: 'bulk',
    },
    defaults: {
      ballWeight: 900,
      ballCount: 1,
      totalTime: 3,
      coldHours: 0,
      roomTemp: 23,
      doughTemp: 25,
      leavenType: 'commercial',
    },
    liquids: [
      { key: 'ing.water', share: 0.5, waterFraction: 1, type: 'water' },
      { key: 'ing.milk', share: 0.5, waterFraction: 0.87, type: 'dairy' },
    ],
    flourBlend: WHEAT,
    characteristicCount: 4,
  },
  {
    id: 'brioche',
    name: 'Brioche',
    category: 'enriched',
    regionKey: 'region.france',
    defaultParams: { hydration_pct: 52, salt_pct: 1.8, sugar_pct: 12, oil_pct: 45, fatKey: 'ing.butter' },
    fermentation: {
      bulk_ratio: 0.55,
      proof_ratio: 0.45,
    },
    process: {
      mixMin: 25,
      shapeKey: 'process.shape.brioche',
      bakeKey: 'process.bake.enriched',
      bakeTempC: 175,
      bakeMinutes: 28,
      coldPhase: 'bulk',
    },
    defaults: {
      ballWeight: 500,
      ballCount: 2,
      totalTime: 14,
      coldHours: 10,
      roomTemp: 22,
      doughTemp: 24,
      leavenType: 'commercial',
    },
    liquids: [
      { key: 'ing.egg', share: 0.7, waterFraction: 0.75, type: 'egg' },
      { key: 'ing.milk', share: 0.3, waterFraction: 0.87, type: 'dairy' },
    ],
    flourBlend: [{ key: 'flour.bread', percentage: 100, protein_pct: 12.5 }],
    minProteinPct: 12,
    characteristicCount: 4,
  },
  {
    id: 'challah',
    name: 'Challah',
    category: 'enriched',
    regionKey: 'region.ashkenaz',
    defaultParams: { hydration_pct: 55, salt_pct: 1.6, sugar_pct: 9, oil_pct: 9, fatKey: 'ing.oil' },
    fermentation: {
      bulk_ratio: 0.55,
      proof_ratio: 0.45,
    },
    process: {
      mixMin: 12,
      shapeKey: 'process.shape.braid',
      bakeKey: 'process.bake.enriched',
      bakeTempC: 180,
      bakeMinutes: 30,
      coldPhase: 'bulk',
    },
    defaults: {
      ballWeight: 800,
      ballCount: 1,
      totalTime: 4,
      coldHours: 0,
      roomTemp: 24,
      doughTemp: 26,
      leavenType: 'commercial',
    },
    liquids: [
      { key: 'ing.water', share: 0.55, waterFraction: 1, type: 'water' },
      { key: 'ing.egg', share: 0.45, waterFraction: 0.75, type: 'egg' },
    ],
    flourBlend: WHEAT,
    characteristicCount: 4,
  },
];

export const getStyleById = (id: string): BreadStyle | undefined =>
  BREAD_STYLES.find((style) => style.id === id);

export const getStylesByCategory = (category: StyleCategory): BreadStyle[] =>
  BREAD_STYLES.filter((style) => style.category === category);

export const STYLE_CATEGORIES: StyleCategory[] = ['pizza', 'preferment', 'bread', 'enriched'];

/** Flour blend as a compact "50% X + 50% Y" string, using a translator for the names. */
export const getFlourBlendText = (
  blend: FlourComponent[] | undefined,
  t: (key: string) => string,
): string => {
  if (!blend?.length) return t('flour.bread');
  return blend.map((f) => `${f.percentage}% ${t(f.key)}`).join(' + ');
};

/** Flour-weighted average protein, used by the strength advisor. */
export const getBlendProtein = (blend: FlourComponent[] | undefined): number | undefined => {
  if (!blend?.length) return undefined;
  const known = blend.filter((f) => typeof f.protein_pct === 'number');
  if (!known.length) return undefined;
  const weight = known.reduce((sum, f) => sum + f.percentage, 0);
  if (weight === 0) return undefined;
  return known.reduce((sum, f) => sum + (f.protein_pct as number) * f.percentage, 0) / weight;
};
