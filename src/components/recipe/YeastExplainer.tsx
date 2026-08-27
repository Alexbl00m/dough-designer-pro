import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BreadStyle } from '@/data/styles';
import type { CalculationResults } from '@/core/types';
import { useI18n } from '@/i18n';
import { formatGrams, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

interface YeastExplainerProps {
  style: BreadStyle;
  results: CalculationResults;
}

/**
 * The full chain from the style's reference dose to the grams on the scale.
 * Every multiplier is shown, so a surprising number can be traced rather than
 * taken on faith.
 */
export function YeastExplainer({ style, results }: YeastExplainerProps) {
  const { t, lang } = useI18n();
  const f = results.fermentation;
  if (f.yeastPct <= 0) return null;

  const n = (value: number, decimals = 2) => formatNumber(value, lang, decimals);
  const c = f.corrections;

  const rows: { label: string; factor: number }[] = [
    { label: t('yeast.time', { hours: n(f.roomEquivHours, 1) }), factor: c.time },
    {
      label: t('yeast.temperature', {
        temp: n(f.roomTempC, 1),
        ref: n(style.fermentation.yeast_ref_temp_c, 1),
      }),
      factor: c.temperature,
    },
    { label: t('yeast.salt', { pct: n(results.params.salt, 1) }), factor: c.salt },
    { label: t('yeast.sugar', { pct: n(results.params.sugar, 1) }), factor: c.sugar },
    { label: t('yeast.hydration', { pct: n(results.params.hydration, 1) }), factor: c.hydration },
    { label: t('yeast.fat', { pct: n(results.params.oil, 1) }), factor: c.fat },
    { label: t('yeast.form', { form: t(`field.yeast.${f.yeastForm}`) }), factor: c.form },
  ];

  const grams = results.totals.flour * (f.yeastPct / 100);

  return (
    <Card className="p-5" data-print-card>
      <h4 className="mb-1 font-semibold">{t('yeast.title')}</h4>
      <p className="mb-4 text-sm text-muted-foreground">
        {t('yeast.base', {
          base: n(style.fermentation.base_yeast_fresh_pct, 3),
          hours: n(style.fermentation.yeast_ref_hours, 1),
          temp: n(style.fermentation.yeast_ref_temp_c, 1),
        })}
      </p>

      <ul className="space-y-1.5">
        {rows.map((row) => {
          // A factor of exactly 1 changes nothing; show it greyed rather than hidden,
          // so the chain still reads as complete.
          const neutral = Math.abs(row.factor - 1) < 0.005;
          return (
            <li
              key={row.label}
              className="flex items-center justify-between gap-3 border-b border-border/50 pb-1.5 text-sm last:border-0"
            >
              <span className={cn(neutral ? 'text-muted-foreground' : 'text-foreground')}>
                {row.label}
              </span>
              <Badge
                variant={neutral ? 'outline' : row.factor > 1 ? 'default' : 'secondary'}
                className="shrink-0 tabular"
              >
                {t('yeast.factor', { value: n(row.factor, 2) })}
              </Badge>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 rounded-lg bg-primary-soft px-3 py-2 text-sm font-semibold tabular text-primary">
        {t('yeast.result', {
          pct: formatNumber(f.yeastPct, lang, 3),
          grams: formatGrams(grams, lang),
        })}
      </p>
    </Card>
  );
}
