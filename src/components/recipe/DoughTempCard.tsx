import { Droplets, Snowflake, Thermometer } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { CalculationResults } from '@/core/types';
import { useI18n } from '@/i18n';
import { formatGrams, formatNumber } from '@/lib/format';

interface DoughTempCardProps {
  water: CalculationResults['water'];
  doughTemp: number;
  roomTempC: number;
  prefermentTempC?: number;
}

/**
 * The DDT card shows the number *and* the arithmetic. A baker who can see the
 * formula can adjust it when their kitchen disagrees with the model.
 */
export function DoughTempCard({
  water,
  doughTemp,
  roomTempC,
  prefermentTempC,
}: DoughTempCardProps) {
  const { t, lang } = useI18n();
  const n = (value: number, decimals = 1) => formatNumber(value, lang, decimals);

  return (
    <Card className="p-5" data-print-card>
      <div className="mb-4 flex items-center gap-2">
        <Thermometer className="h-4 w-4 text-primary" aria-hidden />
        <h4 className="font-semibold">{t('ddt.title')}</h4>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <p className="stat-value text-display-lg text-primary">{n(water.tempC)} °C</p>
          <p className="stat-label mt-0.5">{t('recipe.waterTemp')}</p>
        </div>
        {water.iceGrams > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-info/10 px-3 py-2 text-sm text-info">
            <Snowflake className="h-4 w-4 shrink-0" aria-hidden />
            <span>{t('ddt.ice', { grams: formatGrams(water.iceGrams, lang), temp: n(water.tempC) })}</span>
          </div>
        )}
      </div>

      <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm tabular text-muted-foreground">
        {t('ddt.formula', {
          factors: water.factors,
          ddt: n(doughTemp),
          flour: n(water.flourTempC),
          room: n(roomTempC),
          friction: water.frictionC,
          preferment:
            prefermentTempC !== undefined
              ? t('ddt.prefermentTerm', { temp: n(prefermentTempC) })
              : '',
          result: n(water.rawTempC),
        })}
      </p>

      <p className="mt-3 flex gap-2 text-sm leading-relaxed text-muted-foreground">
        <Droplets className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{t('ddt.explain')}</span>
      </p>
    </Card>
  );
}
