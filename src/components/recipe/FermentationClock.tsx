import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { bulkHoursFor, doublingHoursAt } from '@/core/growth';
import { FULL_FERMENT_PCT } from '@/data/fermentationTable';
import type { CalculationResults } from '@/core/types';
import { useI18n } from '@/i18n';
import { formatGrams, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

interface FermentationClockProps {
  results: CalculationResults;
}

/**
 * Why the ferment takes as long as it does.
 *
 * The headline is the doubling time, because that single number is what makes
 * the sliders intuitive: every doubling of the leavening saves exactly that
 * much time, whatever the dose. Showing it turns "why did halving the starter
 * only add two hours?" into something obvious.
 */
export function FermentationClock({ results }: FermentationClockProps) {
  const { t, lang } = useI18n();
  const f = results.fermentation;
  const n = (value: number, decimals = 1) => formatNumber(value, lang, decimals);

  const clock = {
    tempC: f.roomTempC,
    saltPct: results.params.salt,
    sugarPct: results.params.sugar,
    hydrationPct: results.params.hydration,
    fatPct: results.params.oil,
  };

  const dose = f.starterEquivalentPct;
  // What the neighbouring doses would cost or save, which is the question a
  // baker is actually asking when they reach for the slider.
  const steps = [dose / 2, dose, dose * 2].filter((d) => d >= 0.2 && d <= FULL_FERMENT_PCT);

  return (
    <Card className="p-5" data-print-card>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">{t('clock.title')}</h4>
        <Badge variant="secondary" className="tabular">
          {t('clock.doubling', { hours: n(f.doublingHours) })}
        </Badge>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        {t('clock.lead', { temp: n(f.roomTempC), hours: n(f.doublingHours) })}
      </p>

      <ul className="space-y-1.5">
        {steps.map((d) => {
          const hours = bulkHoursFor(d, clock);
          const current = Math.abs(d - dose) < 1e-6;
          return (
            <li
              key={d}
              className={cn(
                'flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm tabular',
                current ? 'bg-primary-soft font-semibold text-primary' : 'text-muted-foreground',
              )}
            >
              <span>{t('clock.dose', { pct: n(d, 2) })}</span>
              <span>{t('clock.bulk', { hours: n(hours) })}</span>
            </li>
          );
        })}
      </ul>

      {f.timeCorrection !== 1 && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {t(f.timeCorrection > 1 ? 'clock.slower' : 'clock.faster', {
            pct: n(Math.abs(f.timeCorrection - 1) * 100, 0),
          })}
        </p>
      )}

      {f.yeastPct > 0 && (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed text-muted-foreground">
          {t('clock.yeastEquivalent', {
            yeast: formatNumber(f.yeastPct, lang, 3),
            form: t(`field.yeast.${f.yeastForm}`).toLowerCase(),
            grams: formatGrams(results.totals.flour * (f.yeastPct / 100), lang),
            starter: n(f.starterEquivalentPct, 1),
          })}
        </p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {t('clock.source')}
      </p>
    </Card>
  );
}

export { doublingHoursAt };
