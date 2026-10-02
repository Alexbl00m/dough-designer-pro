import { Wheat } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { getBlendProtein, getFlourBlendText } from '@/data/styles';
import type { BreadStyle } from '@/data/styles';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

interface FlourAdvisorProps {
  style: BreadStyle;
  /** Room-equivalent hours — what the gluten actually has to survive. */
  effectiveHours: number;
}

/** A long ferment on weak flour is the most common way a good recipe goes wrong. */
const LONG_FERMENT_HOURS = 24;
const LONG_FERMENT_MIN_PROTEIN = 12.5;

export function FlourAdvisor({ style, effectiveHours }: FlourAdvisorProps) {
  const { t, lang } = useI18n();
  const protein = getBlendProtein(style.flourBlend);
  if (protein === undefined) return null;

  const styleMin = style.minProteinPct;
  const longFerment = effectiveHours >= LONG_FERMENT_HOURS;
  const tooWeakForStyle = styleMin !== undefined && protein < styleMin;
  const tooWeakForTime = longFerment && protein < LONG_FERMENT_MIN_PROTEIN;
  const warn = tooWeakForStyle || tooWeakForTime;

  const n = (value: number) => formatNumber(value, lang, 1);

  return (
    <Card className={cn('p-5', warn && 'border-warning/50')} data-print-card>
      <div className="mb-2 flex items-center gap-2">
        <Wheat className={cn('h-4 w-4', warn ? 'text-warning' : 'text-primary')} aria-hidden />
        <h4 className="font-semibold">{t('flourAdvice.title')}</h4>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {tooWeakForStyle
          ? t('flourAdvice.weak', {
              protein: n(protein),
              min: n(styleMin as number),
              hours: n(effectiveHours),
            })
          : tooWeakForTime
            ? t('flourAdvice.long', { hours: n(effectiveHours) })
            : t('flourAdvice.ok', { protein: n(protein) })}
      </p>

      <p className="mt-2 text-xs text-muted-foreground">
        {getFlourBlendText(style.flourBlend, t)}
      </p>
    </Card>
  );
}
