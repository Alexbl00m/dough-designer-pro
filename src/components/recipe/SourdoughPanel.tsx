import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { leavenPctForTotal } from '@/core/growth';
import type { CalculationResults } from '@/core/types';
import { useI18n } from '@/i18n';
import { formatGrams, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

interface SourdoughPanelProps {
  fermentation: CalculationResults['fermentation'];
  starterHydration: number;
  totalFlour: number;
  salt: number;
  hydration: number;
}

const TIMES = [4, 6, 8, 12, 18, 24, 36];
const TEMPS = [18, 21, 24, 27];
const CHECKLIST_LENGTH = 6;

export function SourdoughPanel({
  fermentation: f,
  starterHydration,
  totalFlour,
  salt,
  hydration,
}: SourdoughPanelProps) {
  const { t, lang } = useI18n();
  if (f.inoculationPct <= 0) return null;

  const n = (value: number, decimals = 1) => formatNumber(value, lang, decimals);
  const levainGrams = totalFlour * (f.inoculationPct / 100) * (1 + starterHydration / 100);

  return (
    <Card className="space-y-6 p-5" data-print-card>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">{t('sd.title')}</h4>
          <Badge variant="secondary" className="tabular">
            {t('sd.ratio', { onFlour: n(f.levainOnFlourPct) })}
          </Badge>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {t('sd.body', {
            inoculation: n(f.inoculationPct),
            onFlour: n(f.levainOnFlourPct),
            grams: formatGrams(levainGrams, lang),
            hydration: n(starterHydration, 0),
          })}
        </p>

        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t('sd.base', { hours: n(f.doublingHours), temp: n(f.roomTempC) })}
        </p>

        <p className="mt-2 text-sm text-muted-foreground">
          {t('sd.peak', { hours: n(f.levainPeakHours), temp: n(f.roomTempC) })}
        </p>

        <p className="mt-2 text-sm tabular text-muted-foreground">
          {t('sd.now', {
            total: n(f.totalHours),
            temp: n(f.roomTempC),
            cold:
              f.coldHours > 0
                ? t('sd.nowCold', { cold: n(f.coldHours), equiv: n(f.roomEquivHours) })
                : '',
          })}
        </p>
      </div>

      <div>
        <h5 className="mb-3 text-sm font-semibold">{t('sd.checklist')}</h5>
        <ul className="space-y-2">
          {Array.from({ length: CHECKLIST_LENGTH }, (_, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>{t(`sd.check.${i}`)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{t('sd.checkFoot')}</p>
      </div>

      <div>
        <h5 className="mb-1 text-sm font-semibold">{t('sd.sensitivity')}</h5>
        <p className="mb-3 text-sm text-muted-foreground">{t('sd.sensitivityLead')}</p>

        {/* Wide tables scroll inside their own box rather than pushing the page sideways. */}
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[22rem] border-collapse text-sm">
            <caption className="sr-only">{t('sd.sensitivity')}</caption>
            <thead>
              <tr>
                <th scope="col" className="py-2 pr-3 text-left font-normal text-muted-foreground">
                  {t('sd.time')}
                </th>
                {TEMPS.map((temp) => (
                  <th
                    key={temp}
                    scope="col"
                    className="px-2 py-2 text-right font-normal tabular text-muted-foreground"
                  >
                    {temp} °C
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIMES.map((hours) => (
                <tr key={hours} className="border-t border-border">
                  <th scope="row" className="py-2 pr-3 text-left font-normal tabular">
                    {hours} h
                  </th>
                  {TEMPS.map((temp) => {
                    const pct = leavenPctForTotal(hours, {
                      tempC: temp,
                      saltPct: salt,
                      hydrationPct: hydration,
                    });
                    const current =
                      Math.abs(hours - f.totalHours) < 0.01 &&
                      Math.abs(temp - f.roomTempC) < 0.01;
                    return (
                      <td
                        key={temp}
                        aria-current={current ? 'true' : undefined}
                        className={cn(
                          'px-2 py-2 text-right tabular',
                          current
                            ? 'rounded bg-primary-soft font-semibold text-primary'
                            : 'text-muted-foreground',
                        )}
                      >
                        {n(pct, pct < 10 ? 2 : 1)}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t('sd.sensitivityFoot')}</p>
      </div>
    </Card>
  );
}
