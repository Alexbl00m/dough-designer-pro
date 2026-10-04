/**
 * Shared plumbing for the MCP tools.
 *
 * The engine speaks in i18n keys so the same result can be rendered in any
 * language. An assistant wants prose, so every tool resolves those keys through
 * the same dictionaries the UI uses before handing anything back.
 */

import { z } from 'zod';
import { getStyleById } from '../../data/styles';
import type { BreadStyle } from '../../data/styles';
import { calculateRecipe } from '../../core/calculations';
import type { CalculationResults } from '../../core/types';
import { createTranslator } from '../../i18n/translate';
import type { Language, Translator } from '../../i18n/translate';

export const languageSchema = z
  .enum(['en', 'sv'])
  .optional()
  .describe("Language for human-readable text. Default 'en'.");

/** Input shared by `calculate_recipe` and `explain_recipe`. */
export const recipeInputSchema = {
  style_id: z.string().min(1).describe("Style id, e.g. 'neapolitan' (see list_styles)."),
  ball_weight: z
    .number()
    .positive()
    .optional()
    .describe("Weight per ball or loaf in grams. Defaults to the style's own."),
  ball_count: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Number of balls or loaves. Defaults to the style's own."),
  target_flour: z
    .number()
    .positive()
    .optional()
    .describe('Scale by a total flour weight in grams instead of by pieces.'),
  target_dough: z
    .number()
    .positive()
    .optional()
    .describe('Scale by a total dough weight in grams instead of by pieces.'),
  total_time: z
    .number()
    .positive()
    .optional()
    .describe(
      "Fermentation hours for the final dough, mix to bake, not counting any preferment. Defaults to the style's own.",
    ),
  preferment_hours: z
    .number()
    .positive()
    .optional()
    .describe("Preferment build in hours, fridge time included. Defaults to the style's own."),
  preferment_temp: z
    .number()
    .optional()
    .describe('Temperature of the warm part of the preferment build, °C. Defaults to the style (or the room).'),
  preferment_cold_hours: z
    .number()
    .min(0)
    .optional()
    .describe("Hours at the end of the preferment build spent in the fridge. Defaults to the style's own."),
  room_temp: z.number().optional().describe("Room temperature in °C. Defaults to the style's own."),
  cold_hours: z.number().min(0).optional().describe('Hours of the total spent in the fridge.'),
  cold_temp: z.number().optional().describe('Fridge temperature in °C. Default 4.'),
  cold_phase: z
    .enum(['bulk', 'proof'])
    .optional()
    .describe("Which phase the retard sits in. Defaults to the style's convention."),
  hydration: z.number().optional().describe("Override hydration in baker's %."),
  salt: z.number().optional().describe("Override salt in baker's %."),
  sugar: z.number().optional().describe("Override sugar in baker's %."),
  oil: z.number().optional().describe("Override fat in baker's %."),
  leaven_type: z
    .enum(['commercial', 'sourdough', 'hybrid'])
    .optional()
    .describe("Leavening. Defaults to the style's own."),
  yeast_form: z.enum(['fresh', 'active_dry', 'instant']).optional().describe("Default 'instant'."),
  mixing: z
    .enum(['hand', 'dlx', 'planetary', 'spiral'])
    .optional()
    .describe("Mixing method, which sets the friction factor. Default 'hand'."),
  desired_dough_temp: z
    .number()
    .optional()
    .describe("Target dough temperature in °C. Defaults to the style's own."),
  flour_temp: z.number().optional().describe('Flour temperature in °C. Defaults to room temp.'),
  starter_hydration: z.number().optional().describe('Levain hydration in %. Default 100.'),
  use_preferment: z
    .boolean()
    .optional()
    .describe("Whether to use the style's preferment. Default true."),
  start_time: z
    .string()
    .optional()
    .describe(
      'ISO timestamp when the plan starts — the first step, preferment or levain build included. Defaults to now.',
    ),
  ready_at: z
    .string()
    .optional()
    .describe(
      'ISO timestamp when the bake should be finished. The whole plan is laid out backwards from it. Takes precedence over start_time.',
    ),
  language: languageSchema,
};

export type RecipeToolInput = {
  [K in keyof typeof recipeInputSchema]: z.infer<(typeof recipeInputSchema)[K]>;
};

export interface ResolvedRecipe {
  style: BreadStyle;
  results: CalculationResults;
  t: Translator;
  lang: Language;
}

/** Turn tool input into a calculated recipe, filling gaps from the style's defaults. */
export function resolveRecipe(input: RecipeToolInput): ResolvedRecipe | { error: string } {
  const style = getStyleById(input.style_id);
  if (!style) {
    return { error: `Unknown style id: ${input.style_id}. Use list_styles to see valid ids.` };
  }

  const lang: Language = input.language ?? 'en';
  const d = style.defaults;

  const now = new Date();
  const startTime = input.start_time ? new Date(input.start_time) : now;
  if (Number.isNaN(startTime.getTime())) {
    return { error: `Invalid start_time: ${input.start_time}. Use an ISO timestamp.` };
  }
  const readyAt = input.ready_at ? new Date(input.ready_at) : undefined;
  if (readyAt && Number.isNaN(readyAt.getTime())) {
    return { error: `Invalid ready_at: ${input.ready_at}. Use an ISO timestamp.` };
  }

  const scaleMode = input.target_flour ? 'flour' : input.target_dough ? 'dough' : 'pieces';

  const results = calculateRecipe({
    style,
    scaleMode,
    ballWeight: input.ball_weight ?? d.ballWeight,
    ballCount: input.ball_count ?? d.ballCount,
    targetFlour: input.target_flour,
    targetDough: input.target_dough,
    totalTime: input.total_time ?? d.totalTime,
    roomTemp: input.room_temp ?? d.roomTemp,
    coldTemp: input.cold_temp,
    coldHours: input.cold_hours ?? d.coldHours,
    coldPhase: input.cold_phase,
    hydration: input.hydration,
    salt: input.salt,
    sugar: input.sugar,
    oil: input.oil,
    leavenType: input.leaven_type ?? d.leavenType,
    yeastForm: input.yeast_form ?? 'instant',
    mixing: input.mixing ?? 'hand',
    desiredDoughTemp: input.desired_dough_temp ?? d.doughTemp,
    flourTemp: input.flour_temp,
    starterHydration: input.starter_hydration,
    usePreferment: input.use_preferment,
    prefermentHours: input.preferment_hours,
    prefermentTemp: input.preferment_temp,
    prefermentColdHours: input.preferment_cold_hours,
    plan: readyAt ? { mode: 'ready', at: readyAt } : { mode: 'start', at: startTime },
    now,
  });

  return { style, results, t: createTranslator(lang), lang };
}

/** The calculation, with every i18n key already resolved to text. */
export function toReadable({ style, results, t }: ResolvedRecipe) {
  return {
    style: {
      id: style.id,
      name: style.name,
      category: style.category,
      region: t(style.regionKey),
      description: t(`style.${style.id}.desc`),
    },
    totals: results.totals,
    water: results.water,
    fermentation: results.fermentation,
    preferment: results.preferment,
    params: results.params,
    sections: results.sections.map((section) => ({
      id: section.id,
      title: t(section.titleKey),
      meta: section.meta,
      total_grams: section.totalGrams,
      ingredients: section.ingredients.map((ing) => ({
        name: t(ing.key),
        grams: ing.grams,
        bakers_percent: ing.percentage,
        type: ing.type,
      })),
    })),
    timeline: results.timeline.map((step) => ({
      at: step.at,
      offset_minutes: step.offsetMin,
      duration_minutes: step.durationMin,
      phase: step.phase,
      title: t(step.key, resolveTechnique(step.values, t)),
      detail: t(`${step.key}.body`, resolveTechnique(step.values, t)),
    })),
    notes: results.notes.map((note) => ({
      severity: note.severity,
      text: t(note.code, note.values),
    })),
    ready_at: results.readyAt,
    plan: {
      starts_at: results.plan.startsAt,
      mix_at: results.plan.mixAt,
      ready_at: results.plan.readyAt,
      span_hours: results.plan.spanHours,
      ferment_hours: results.plan.fermentHours,
      starts_in_past: results.plan.startsInPast,
      earliest_ready_at: results.plan.earliestReadyAt,
      night_steps: results.plan.nightSteps.map((i) => {
        const step = results.timeline[i];
        return { at: step.at, title: t(step.key, resolveTechnique(step.values, t)) };
      }),
      daytime_shift_minutes: results.plan.daytimeShiftMin,
    },
  };
}

/** A fold's technique is itself a key and has to be translated before use. */
function resolveTechnique(
  values: Record<string, string | number> | undefined,
  t: Translator,
): Record<string, string | number> | undefined {
  if (!values?.technique) return values;
  return { ...values, technique: t(String(values.technique)) };
}
