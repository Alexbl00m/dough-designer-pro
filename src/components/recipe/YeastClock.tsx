import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { YEAST_CONVERSION } from '@/core/constants';
import { freshYeastFor, hoursForFreshYeast } from '@/core/yeast';
import type { CalculationResults } from '@/core/types';
import { useI18n } from '@/i18n';
import { formatNumber, formatYeastPct } from '@/lib/format';
import { cn } from '@/lib/utils';

interface YeastClockProps {
  results: CalculationResults;
}

const HOURS = [3, 4, 6, 8, 12, 24, 48];
const TEMPS = [18, 20, 22, 24, 26];

/**
 * How commercial yeast trades against time and temperature, for this recipe.
 *
 * The neighbours answer the question a baker asks at the slider — what would
 * half or double the yeast do? — and the table is the chart pizza bakers know
 * from TXCraig1, worked out for this recipe's own salt, sugar, water and fat.
 */
export function YeastClock({ results }: YeastClockProps) {
  const { t, lang } = useI18n();
  const f = results.fermentation;
  const p = results.params;
  const n = (value: number, decimals = 1) => formatNumber(value, lang, decimals);
  const conversion = YEAST_CONVERSION[f.yeastForm];
  const form = t(`field.yeast.${f.yeastForm}`);

  const recipe = {
    saltPct: p.salt,
    sugarPct: p.sugar,
    hydrationPct: p.hydration,
    fatPct: p.oil,
    prefermentShare: p.prefermentFlourPct / 100,
  };
  const schedule = {
    roomTempC: f.roomTempC,
    coldHours: f.coldHours,
    coldTempC: f.coldTempC,
  };

  // Half and double the yeast the baker adds, with whatever the preferment
  // carries still counted, so the neighbours stay honest with a poolish.
  const neighbours =
    f.freshYeastPct > 0
      ? [0.5, 1, 2].map((factor) => ({
          factor,
          added: f.freshYeastPct * factor,
          hours: hoursForFreshYeast(
            f.freshYeastPct * factor + f.prefermentLeaveningPct,
            schedule,
            recipe,
          ),
        }))
      : [];

  // The highlighted cell is the one nearest the baker's own time and room.
  const nearestHours = HOURS.reduce((a, b) =>
    Math.abs(b - f.totalHours) < Math.abs(a - f.totalHours) ? b : a,
  );
  const nearestTemp = TEMPS.reduce((a, b) =>
    Math.abs(b - f.roomTempC) < Math.abs(a - f.roomTempC) ? b : a,
  );

  return (
    <Card className="p-5" data-print-card>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">{t('yeastClock.title')}</h4>
        <Badge variant="secondary" className="tabular">
          {n(f.roomTempC)} °C
        </Badge>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{t('yeastClock.lead')}</p>

      {neighbours.length > 0 && (
        <ul className="space-y-1.5">
          {neighbours.map(({ factor, added, hours }) => (
            <li
              key={factor}
              className={cn(
                'flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm tabular',
                factor === 1 ? 'bg-primary-soft font-semibold text-primary' : 'text-muted-foreground',
              )}
            >
              <span>
                {t('yeastClock.dose', {
                  pct: formatYeastPct(added * conversion, lang),
                  form: form.toLowerCase(),
                })}
              </span>
              <span>{t('yeastClock.hours', { hours: n(hours) })}</span>
            </li>
          ))}
        </ul>
      )}

      {f.prefermentLeaveningPct > 0 && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t('yeastClock.carried', { pct: n(f.prefermentLeaveningPct, 2) })}
        </p>
      )}

      <h5 className="mt-5 text-sm font-semibold">{t('yeastClock.table')}</h5>
      <p className="mb-2 mt-1 text-xs leading-relaxed text-muted-foreground">
        {t('yeastClock.tableLead', { form })}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular">
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="py-1 pr-2 text-left font-medium">
                h
              </th>
              {TEMPS.map((temp) => (
                <th key={temp} scope="col" className="px-1 py-1 text-right font-medium">
                  {temp} °C
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hours) => (
              <tr key={hours} className="border-t border-border/60">
                <th scope="row" className="py-1 pr-2 text-left font-medium text-muted-foreground">
                  {hours}
                </th>
                {TEMPS.map((temp) => {
                  const fresh = freshYeastFor(
                    { totalHours: hours, roomTempC: temp },
                    { ...recipe, prefermentShare: 0 },
                  );
                  const here = hours === nearestHours && temp === nearestTemp;
                  return (
                    <td
                      key={temp}
                      className={cn(
                        'px-1 py-1 text-right',
                        here && 'rounded bg-primary-soft font-semibold text-primary',
                      )}
                    >
                      {formatYeastPct(fresh * conversion, lang)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t('yeastClock.source')}</p>
    </Card>
  );
}
