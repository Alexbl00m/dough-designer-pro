import { Card } from '@/components/ui/card';
import { FlourStrength } from '@/components/FlourCard';
import type { FlourAdvice } from '@/core/flour';
import { flourKey } from '@/data/flours';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

interface FlourAdvisorProps {
  advice: FlourAdvice;
}

/**
 * A long ferment on weak flour is the most common way a good recipe goes
 * wrong, so the recipe says what the blend can stand and what the plan asks.
 */
export function FlourAdvisor({ advice }: FlourAdvisorProps) {
  const { t, lang } = useI18n();
  const warn = advice.fit === 'weak';

  return (
    <Card className={cn('p-5', warn && 'border-warning/50')} data-print-card>
      <h2 className="mb-2 text-display-sm">{t('flourAdvice.title')}</h2>
      <p className="text-sm text-muted-foreground">
        {advice.parts
          .map((p) => `${formatNumber(p.pct, lang, 0)}% ${t(flourKey(p.id))}`)
          .join(' + ')}
      </p>
      <FlourStrength advice={advice} />
    </Card>
  );
}
