import type {
  BreadStyle,
  IngredientType,
  PrefermentType,
} from '@/data/styles';
import type { MixingMethod, YeastForm } from './constants';

export type LeavenType = 'commercial' | 'sourdough' | 'hybrid';
export type ScaleMode = 'pieces' | 'flour' | 'dough';

export interface CalculationInputs {
  style: BreadStyle;
  /** How the batch is sized: by pieces, by a flour weight you have, or by a total dough weight. */
  scaleMode?: ScaleMode;
  ballWeight: number;
  ballCount: number;
  /** Used when scaleMode is 'flour' or 'dough'. */
  targetFlour?: number;
  targetDough?: number;

  /** Fermentation time in hours for the final dough (bulk + proof), excluding any preferment. */
  totalTime: number;
  roomTemp: number;
  coldTemp?: number;
  coldHours?: number;
  /** Which phase the cold retard sits in. Defaults to the style's own convention. */
  coldPhase?: 'bulk' | 'proof';

  leavenType: LeavenType;
  yeastForm: YeastForm;
  mixing: MixingMethod;
  desiredDoughTemp: number;
  /** Flour temperature for the DDT calculation; defaults to room temperature. */
  flourTemp?: number;

  /** Baker's-% overrides of the style defaults. */
  hydration?: number;
  salt?: number;
  sugar?: number;
  oil?: number;

  /** Levain hydration, in %. 100 = equal flour and water. */
  starterHydration?: number;
  /** Turn the style's preferment on or off. Defaults to on when the style has one. */
  usePreferment?: boolean;
  /** Wall-clock start of the schedule, ISO or Date. Defaults to now. */
  startTime?: Date;
}

export interface Ingredient {
  /** i18n key, or a literal name when no key exists. */
  key: string;
  grams: number;
  /** Share of TOTAL flour, in percent — the baker's percentage. */
  percentage: number;
  type: IngredientType;
  /** Set when the ingredient is only part of a preferment or the final dough. */
  note?: string;
}

export interface RecipeSection {
  id: 'preferment' | 'levain' | 'final';
  /** i18n key for the section heading. */
  titleKey: string;
  /** Extra context, e.g. "16 h at 18 °C". */
  meta?: { hours: number; tempC: number; type?: PrefermentType };
  ingredients: Ingredient[];
  totalGrams: number;
}

export type NoteSeverity = 'info' | 'tip' | 'warn';

/** Notes are structured so the UI can translate and style them. */
export interface Note {
  code: string;
  severity: NoteSeverity;
  values?: Record<string, string | number>;
}

export type TimelinePhase =
  | 'preferment'
  | 'levain'
  | 'autolyse'
  | 'mix'
  | 'bulk'
  | 'fold'
  | 'divide'
  | 'shape'
  | 'proof'
  | 'cold'
  | 'bake'
  | 'done';

export interface TimelineStep {
  /** Minutes from the start of the schedule. Negative for preferment steps built the day before. */
  offsetMin: number;
  /** Wall-clock time, ISO string. */
  at: string;
  /** Duration of this step in minutes; 0 for instants. */
  durationMin: number;
  phase: TimelinePhase;
  /** i18n key for the step title. */
  key: string;
  values?: Record<string, string | number>;
  tempC?: number;
}

export interface CalculationResults {
  sections: RecipeSection[];
  /** Every ingredient across all sections, merged — the shopping-list view. */
  ingredients: Ingredient[];
  totals: {
    flour: number;
    water: number;
    /** Water from every source, including milk and eggs. */
    trueWater: number;
    trueHydrationPct: number;
    doughWeight: number;
    targetDoughWeight: number;
    perPiece: number;
    pieces: number;
  };
  water: {
    tempC: number;
    rawTempC: number;
    clamped: boolean;
    factors: number;
    frictionC: number;
    flourTempC: number;
    /** The DDT the water temperature was solved for. */
    desiredDoughTempC: number;
    /** Grams of ice to swap for water when the target is below fridge-cold tap water. */
    iceGrams: number;
  };
  fermentation: {
    bulkHours: number;
    proofHours: number;
    coldHours: number;
    coldPhase: 'bulk' | 'proof';
    roomEquivHours: number;
    totalHours: number;
    yeastPct: number;
    yeastForm: YeastForm;
    /** Starter flour as a share of TOTAL flour — the engine's own convention. */
    inoculationPct: number;
    /** Ripe levain as a share of TOTAL flour. */
    starterPct: number;
    /**
     * Ripe levain as a share of the flour it is added to. This is what recipes
     * mean by "20% inoculation", so it is the figure to show a baker.
     */
    levainOnFlourPct: number;
    baseInoculationPct: number;
    levainRefHours: number;
    levainRefTempC: number;
    /** How long the levain itself needs to peak at the baker's room temperature. */
    levainPeakHours: number;
    /** Seed as a share of the finished levain, e.g. 0.2 for a 1:2:2 feed. */
    levainSeedShare: number;
    leavenType: LeavenType;
    roomTempC: number;
    coldTempC: number;
    /** The multipliers that produced the final yeast dose, for the explain view. */
    corrections: {
      time: number;
      temperature: number;
      salt: number;
      sugar: number;
      hydration: number;
      fat: number;
      form: number;
    };
  };
  params: {
    hydration: number;
    salt: number;
    sugar: number;
    oil: number;
    starterHydration: number;
    prefermentFlourPct: number;
  };
  timeline: TimelineStep[];
  notes: Note[];
  readyAt: string;
}
