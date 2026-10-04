import { AlertTriangle, CalendarClock, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { CalculationResults, PlanMode } from '@/core/types';
import type { PlanState } from '@/lib/recipe/plan';
import { useI18n } from '@/i18n';
import { formatDateTime, formatNumber, resolveStepValues, toDateTimeLocal } from '@/lib/format';

interface PlanCardProps {
  results: CalculationResults;
  plan: PlanState;
  onPlanChange: (plan: PlanState) => void;
  /** The preferment's name, when there is one, for the fermentation line. */
  prefermentLabel?: string;
}

/**
 * When the bake happens. Most bakers start from the end — "pizza at six" — so
 * that is the default, and the whole plan, preferment included, is laid out
 * backwards from it. Anything that cannot be lived with is said out loud, with
 * a one-click way out.
 */
export function PlanCard({ results, plan, onPlanChange, prefermentLabel }: PlanCardProps) {
  const { t, lang } = useI18n();
  const p = results.plan;
  const anchorIso = plan.mode === 'ready' ? p.readyAt : p.startsAt;
  const when = (iso: string) => formatDateTime(iso, lang);

  return (
    <Card className="p-5" data-print-card>
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
        <h3 className="text-base font-semibold">{t('params.plan')}</h3>
      </div>

      <div className="space-y-4">
        <ToggleGroup
          type="single"
          value={plan.mode}
          onValueChange={(value) => {
            if (value) onPlanChange({ mode: value as PlanMode, at: null });
          }}
          className="w-full justify-start rounded-lg bg-muted p-1 sm:w-auto"
          aria-label={t('params.plan')}
        >
          {(['ready', 'start'] as const).map((mode) => (
            <ToggleGroupItem
              key={mode}
              value={mode}
              size="sm"
              className="flex-1 data-[state=on]:bg-card data-[state=on]:text-foreground sm:flex-none"
            >
              {t(`plan.mode.${mode}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="space-y-2">
          <Label htmlFor="planAt" className="text-sm">
            {t(plan.mode === 'ready' ? 'plan.when.ready' : 'plan.when.start')}
          </Label>
          <Input
            id="planAt"
            type="datetime-local"
            value={toDateTimeLocal(new Date(anchorIso))}
            onChange={(event) => {
              const next = new Date(event.target.value);
              if (!Number.isNaN(next.getTime())) onPlanChange({ mode: plan.mode, at: next });
            }}
            className="tabular sm:max-w-xs"
          />
          <p className="text-xs text-muted-foreground">
            {plan.at === null ? (
              t(plan.mode === 'ready' ? 'plan.auto.ready' : 'plan.auto.start')
            ) : (
              <button
                type="button"
                onClick={() => onPlanChange({ mode: plan.mode, at: null })}
                className="text-primary underline-offset-2 hover:underline"
              >
                {t('plan.reset')}
              </button>
            )}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <PlanStat label={t('plan.startsAt')} value={when(p.startsAt)} />
          <PlanStat label={t('plan.mixAt')} value={when(p.mixAt)} />
          <PlanStat label={t('plan.readyAt')} value={when(p.readyAt)} />
          <PlanStat label={t('plan.span')} value={`${formatNumber(p.spanHours, lang)} h`} />
        </dl>

        {prefermentLabel && results.preferment && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm tabular text-muted-foreground">
            {t('plan.fermentSplit', {
              type: prefermentLabel,
              pref: formatNumber(results.preferment.hours, lang),
              dough: formatNumber(results.fermentation.totalHours, lang),
              total: formatNumber(p.fermentHours, lang),
            })}
          </p>
        )}

        <PlanWarnings results={results} plan={plan} onPlanChange={onPlanChange} />
      </div>
    </Card>
  );
}

function PlanStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="stat-label">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular">{value}</dd>
    </div>
  );
}

/**
 * The two things that make a plan unlivable — it should have started already,
 * or it has the baker up at three in the morning — each with the fix.
 */
export function PlanWarnings({
  results,
  plan,
  onPlanChange,
}: {
  results: CalculationResults;
  plan: PlanState;
  onPlanChange: (plan: PlanState) => void;
}) {
  const { t, lang } = useI18n();
  const p = results.plan;
  const when = (iso: string) => formatDateTime(iso, lang);

  const firstNight = p.nightSteps.length ? results.timeline[p.nightSteps[0]] : undefined;
  const shifted = (iso: string) =>
    new Date(Date.parse(iso) + (p.daytimeShiftMin ?? 0) * 60_000).toISOString();

  if (!p.startsInPast && !firstNight) return null;

  return (
    <div className="space-y-3">
      {p.startsInPast && (
        <div className="flex gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <div className="space-y-2">
            <p className="leading-relaxed">
              {t('plan.past', { ready: when(p.readyAt), start: when(p.startsAt) })}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPlanChange({ mode: 'ready', at: new Date(p.earliestReadyAt) })}
            >
              {t('plan.past.fix', { time: when(p.earliestReadyAt) })}
            </Button>
          </div>
        </div>
      )}

      {firstNight && !p.startsInPast && (
        <div className="flex gap-2.5 rounded-lg border border-border bg-muted px-3 py-2.5 text-sm">
          <Moon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div className="space-y-2">
            <p className="leading-relaxed">
              {t('plan.night', {
                count: p.nightSteps.length,
                time: when(firstNight.at),
                step: t(firstNight.key, resolveStepValues(firstNight.values, t)),
              })}
            </p>
            {p.daytimeShiftMin !== null ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onPlanChange({
                    mode: plan.mode,
                    at: new Date(shifted(plan.mode === 'ready' ? p.readyAt : p.startsAt)),
                  })
                }
              >
                {plan.mode === 'ready'
                  ? t('plan.night.fixReady', { time: when(shifted(p.readyAt)) })
                  : t('plan.night.fixStart', { time: when(shifted(p.startsAt)) })}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">{t('plan.night.none')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
