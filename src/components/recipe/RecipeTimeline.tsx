import {
  ChefHat,
  Clock,
  CookingPot,
  Croissant,
  FlaskConical,
  Hand,
  Refrigerator,
  Scissors,
  Sparkles,
  Timer,
  Wheat,
} from 'lucide-react';
import type { TimelinePhase, TimelineStep } from '@/core/types';
import { useI18n } from '@/i18n';
import { dayIndex, formatClock, formatDuration, resolveStepValues } from '@/lib/format';
import { cn } from '@/lib/utils';

const ICON: Record<TimelinePhase, typeof Clock> = {
  preferment: FlaskConical,
  levain: FlaskConical,
  autolyse: Wheat,
  mix: Hand,
  bulk: Timer,
  fold: Sparkles,
  divide: Scissors,
  shape: Croissant,
  proof: Timer,
  cold: Refrigerator,
  bake: CookingPot,
  done: ChefHat,
};

/** Phases that are a span of time rather than an instant get a filled marker. */
const SPAN_PHASES = new Set<TimelinePhase>(['preferment', 'levain', 'bulk', 'proof', 'cold', 'autolyse']);

interface RecipeTimelineProps {
  steps: TimelineStep[];
  startIso: string;
}

export function RecipeTimeline({ steps, startIso }: RecipeTimelineProps) {
  const { t, lang } = useI18n();

  let lastDay: number | null = null;

  return (
    <ol className="relative space-y-0">
      {steps.map((step, index) => {
        const Icon = ICON[step.phase];
        const day = dayIndex(startIso, step.at);
        const showDay = day !== lastDay;
        lastDay = day;
        const isSpan = SPAN_PHASES.has(step.phase);
        const isLast = index === steps.length - 1;

        const values = resolveStepValues(step.values, t);

        return (
          <li key={`${step.key}-${step.offsetMin}-${index}`}>
            {showDay && (
              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
                {day < 0
                  ? t('timeline.dayBefore')
                  : t('timeline.day', { n: day + 1 })}
              </p>
            )}

            <div className="relative flex gap-3 pb-4">
              {/* Connector line, stopping at the final step */}
              {!isLast && (
                <span
                  className="absolute left-[15px] top-8 h-full w-px bg-border"
                  aria-hidden
                />
              )}

              <span
                className={cn(
                  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                  isSpan
                    ? 'border-primary/30 bg-primary-soft text-primary'
                    : 'border-border bg-card text-muted-foreground',
                  step.phase === 'cold' && 'border-info/40 text-info',
                  step.phase === 'bake' && 'border-warning/40 text-warning',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <time
                    dateTime={step.at}
                    className="text-sm font-semibold tabular text-primary"
                  >
                    {formatClock(step.at, lang)}
                  </time>
                  <span className="font-semibold">{t(step.key, values)}</span>
                  {step.durationMin > 0 && (
                    <span className="text-xs tabular text-muted-foreground">
                      {formatDuration(step.durationMin, t)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  {t(`${step.key}.body`, values)}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
