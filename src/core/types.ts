import type {
  BreadStyle,
  IngredientType,
  PrefermentType,
} from '@/data/styles';
import type { MixingMethod, YeastForm } from './constants';
import type { BlendPart, FlourAdvice } from './flour';

export type LeavenType = 'commercial' | 'sourdough' | 'hybrid';
export type ScaleMode = 'pieces' | 'flour' | 'dough';

/**
 * Which flour weight the baker's percentages are measured against.
 *
 * Both conventions are in active use and published recipes rarely say which
 * they mean. Full Proof Baking quotes salt against the total including the
 * starter's flour; Russell Peace Baker quotes it against "flour added directly
 * to the dough, not including starter flour". The same loaf reads as 1.8% or
 * 2.0% salt depending on the choice, so the app names it rather than guessing.
 */
export type PercentBasis = 'total' | 'dough';

/**
 * Which end of the fermentation clock the baker is holding.
 *
 * 'time' — "I need it ready by six": the schedule is fixed and the dose follows.
 * 'dose' — "I have this much starter": the dose is fixed and the time follows.
 *
 * Both run the same equation, so the two sliders can never disagree.
 */
export type FermentDriver = 'time' | 'dose';

/**
 * Which moment of the plan the baker pins to the clock.
 *
 * 'ready' — "I want to eat at six": everything is laid out backwards from the
 *           end of the bake, preferment included.
 * 'start' — "I am starting now": the first step (preferment, levain or mix)
 *           is pinned and everything follows from it.
 * 'mix'   — the moment the dough is mixed. The engine's original anchor, kept
 *           for callers that pass `startTime`.
 */
export type PlanAnchorMode = 'start' | 'mix' | 'ready';
export type PlanMode = Exclude<PlanAnchorMode, 'mix'>;

export interface CalculationInputs {
  style: BreadStyle;
  /** How the batch is sized: by pieces, by a flour weight you have, or by a total dough weight. */
  scaleMode?: ScaleMode;
  ballWeight: number;
  ballCount: number;
  /** Used when scaleMode is 'flour' or 'dough'. */
  targetFlour?: number;
  targetDough?: number;

  /** Which end of the clock is fixed. Default 'time'. */
  driver?: FermentDriver;
  /** Fermentation time in hours (bulk + proof). Used when `driver` is 'time'. */
  totalTime: number;
  /**
   * Levain dose as ripe levain over dough flour — the convention recipes use.
   * Used when `driver` is 'dose' and the dough is leavened with a starter.
   */
  leavenPct?: number;
  /**
   * Fresh yeast added to the final dough, % of total flour. Used when `driver`
   * is 'dose' and the dough is leavened with commercial yeast; other forms are
   * converted from it, so switching form never moves the schedule.
   */
  yeastPct?: number;
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

  /** Which flour weight the percentages below are measured against. Default 'total'. */
  percentBasis?: PercentBasis;

  /** Baker's-% overrides of the style defaults, in `percentBasis` terms. */
  hydration?: number;
  salt?: number;
  sugar?: number;
  oil?: number;

  /** Levain hydration, in %. 100 = equal flour and water. */
  starterHydration?: number;
  /**
   * The baker's own flours, up to three, with their shares. Replaces the
   * style's blend; shares are scaled to add up to 100.
   */
  flourBlend?: BlendPart[];
  /** Turn the style's preferment on or off. Defaults to on when the style has one. */
  usePreferment?: boolean;
  /** Preferment build time in hours, fridge included. Defaults to the style's own. */
  prefermentHours?: number;
  /** Temperature of the warm part of the preferment build. Defaults to the style's own. */
  prefermentTemp?: number;
  /** Hours at the end of the preferment build spent in the fridge. Defaults to the style's own. */
  prefermentColdHours?: number;

  /** Pin the plan to the clock: when it starts, or when the bake is done. */
  plan?: { mode: PlanMode; at: Date };
  /** When the dough is mixed. Used when no `plan` is given; defaults to now. */
  startTime?: Date;
  /** The current time, for telling a plan that would have to start in the past. */
  now?: Date;
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
  /** Extra context, e.g. "16 h at 18 °C", or "2 h at 20 °C, then 16 h in the fridge". */
  meta?: {
    hours: number;
    tempC: number;
    type?: PrefermentType;
    /** Hours of `hours` spent in the fridge, at the end of the build. */
    coldHours?: number;
    coldTempC?: number;
  };
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
  /** Whether the baker has to do something at this moment. */
  handsOn: boolean;
}

/** The preferment as built for this plan. */
export interface PrefermentResult {
  type: PrefermentType;
  /** Share of the total flour that goes into it, %. */
  flourPct: number;
  /** Whole build, fridge included. */
  hours: number;
  /** Temperature of the warm part. */
  tempC: number;
  coldHours: number;
  coldTempC: number;
  /** Temperature it goes into the mix at: after an hour on the bench, if it spent the night in the fridge. */
  mixTempC: number;
  /** Hours out of the fridge before the mix, inside `coldHours`. */
  temperHours: number;
  /** Yeast in the preferment, in the chosen form, % of the preferment's own flour. */
  yeastPct: number;
  /** The same as fresh yeast. */
  freshYeastPct: number;
  /** Leavening it carries into the final dough, as fresh yeast on the total flour. */
  leaveningPct: number;
}

/** Where the plan sits on the clock, and whether it can be lived with. */
export interface PlanResult {
  mode: PlanAnchorMode;
  /** The first step: preferment or levain build, autolyse, or the mix. */
  startsAt: string;
  mixAt: string;
  /** The bake is finished. */
  readyAt: string;
  /** First step to finished bake, hours. */
  spanHours: number;
  /** Preferment plus dough fermentation, hours: what a baker means by "24 h in total". */
  fermentHours: number;
  /** The plan would have to start before now. */
  startsInPast: boolean;
  /** The soonest the bake can be finished, starting at the next quarter hour. */
  earliestReadyAt: string;
  /** Indices into the timeline of hands-on steps that fall at night (23–06). */
  nightSteps: number[];
  /** The nearest shift of the whole plan, in minutes, that keeps every hands-on step in the day. */
  daytimeShiftMin: number | null;
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
    /** Where the dough really lands with this water — off target only when the water was limited. */
    doughTempC: number;
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
    /** Yeast added to the final dough, in the chosen form, % of total flour. */
    yeastPct: number;
    /** The same as fresh yeast. */
    freshYeastPct: number;
    /** All the yeast in the recipe, preferment included, in the chosen form, % of total flour. */
    totalYeastPct: number;
    yeastForm: YeastForm;
    /** Leavening the ripe preferment carries into the final dough, as fresh yeast on total flour. */
    prefermentLeaveningPct: number;
    /**
     * When the preferment alone would have the dough ready well before the
     * planned time: how many hours it would take. Unset otherwise.
     */
    prefermentReadyHours?: number;
    /** Starter flour as a share of TOTAL flour — the engine's own convention. */
    inoculationPct: number;
    /** Ripe levain as a share of TOTAL flour. */
    starterPct: number;
    /**
     * Ripe levain as a share of the flour it is added to. This is what recipes
     * mean by "20% inoculation", so it is the figure to show a baker.
     */
    levainOnFlourPct: number;
    /** How long the levain itself needs to peak at the baker's room temperature. */
    levainPeakHours: number;
    /** Seed as a share of the finished levain, e.g. 0.2 for a 1:2:2 feed. */
    levainSeedShare: number;
    leavenType: LeavenType;
    roomTempC: number;
    coldTempC: number;
    driver: FermentDriver;
    /** Hours saved per doubling of the dose at this temperature. */
    doublingHours: number;
    /** How much the recipe's salt, sugar, water and fat stretch the clock. */
    timeCorrection: number;
    /** The dose expressed in the currency both leavening types share. */
    starterEquivalentPct: number;
  };
  params: {
    hydration: number;
    salt: number;
    sugar: number;
    oil: number;
    starterHydration: number;
    prefermentFlourPct: number;
    percentBasis: PercentBasis;
    /** The flour weight the displayed percentages divide by. */
    basisFlour: number;
  };
  preferment?: PrefermentResult;
  /** The blend's strength against what the plan asks of it, with suggestions. */
  flour: FlourAdvice;
  timeline: TimelineStep[];
  plan: PlanResult;
  notes: Note[];
  readyAt: string;
}
