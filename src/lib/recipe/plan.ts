/**
 * The baker's plan: when they want to be done, or when they start.
 *
 * Kept out of the URL on purpose. A shared recipe is timeless; the plan is
 * personal, and a link opened next week should not carry last week's dinner.
 */

import { calculateRecipe } from '@/core/calculations';
import { ceilToQuarter, nextClockTime } from '@/core/schedule';
import type { CalculationInputs, CalculationResults, PlanMode } from '@/core/types';

export interface PlanState {
  mode: PlanMode;
  /** Null until the baker picks a time: then the plan follows the suggestion. */
  at: Date | null;
}

/** Dinner. A bake that can be ready by six in the evening is ready by six. */
export const DEFAULT_READY_HOUR = 18;

export const DEFAULT_PLAN: PlanState = { mode: 'ready', at: null };

type RecipeInputs = Omit<CalculationInputs, 'plan' | 'startTime' | 'now'>;

/**
 * The time the plan is pinned to. Without one picked, a ready-by plan aims for
 * the first six o'clock the recipe can still make, and a start plan starts at
 * the next quarter hour.
 */
export function resolvePlanAnchor(inputs: RecipeInputs, plan: PlanState, now: Date): Date {
  if (plan.at) return plan.at;
  const start = ceilToQuarter(now);
  if (plan.mode === 'start') return start;
  const probe = calculateRecipe({ ...inputs, plan: { mode: 'start', at: start }, now });
  return nextClockTime(new Date(probe.plan.readyAt), DEFAULT_READY_HOUR);
}

export function calculateWithPlan(
  inputs: RecipeInputs,
  plan: PlanState,
  now: Date,
): CalculationResults {
  const at = resolvePlanAnchor(inputs, plan, now);
  return calculateRecipe({ ...inputs, plan: { mode: plan.mode, at }, now });
}
