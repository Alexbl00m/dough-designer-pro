import { Plus, RotateCcw, Wheat, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FLOURS, FLOUR_GROUPS, flourKey } from '@/data/flours';
import type { BreadStyle } from '@/data/styles';
import { isPizzaStyle } from '@/data/styles';
import { partsOfStyleBlend } from '@/core/flour';
import type { BlendPart, FlourAdvice } from '@/core/flour';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const MAX_FLOURS = 3;

interface FlourCardProps {
  style: BreadStyle;
  /** The baker's own blend, or null for the style's. */
  blend: BlendPart[] | null;
  advice?: FlourAdvice;
  onChange: (blend: BlendPart[] | null) => void;
}

/**
 * Which flours go in, and how much of each. One flour is the common case;
 * two or three is how pizzaioli tune strength, cutting a soft 00 with a
 * Manitoba for a longer ferment. Shares always add up to 100: moving one
 * moves the others in proportion.
 */
export function FlourCard({ style, blend, advice, onChange }: FlourCardProps) {
  const { t, lang } = useI18n();
  const rows = blend ?? partsOfStyleBlend(style.flourBlend).map(({ id, pct }) => ({ id, pct }));
  const parts = rows.length ? rows : [{ id: 'bread', pct: 100 }];
  const pizza = isPizzaStyle(style);
  const name = (id: string) => t(flourKey(id));
  const sum = parts.reduce((s, p) => s + p.pct, 0);

  const setShare = (index: number, value: number) => {
    const pct = Math.round(Math.min(100, Math.max(0, value)));
    if (parts.length === 1) return;
    const others = parts.filter((_, i) => i !== index);
    const othersSum = others.reduce((s, p) => s + p.pct, 0);
    const rest = 100 - pct;
    const scaled = others.map((p) => ({
      ...p,
      pct: othersSum > 0 ? Math.round((p.pct / othersSum) * rest) : Math.round(rest / others.length),
    }));
    // Whole percentages that still add up to 100.
    scaled[scaled.length - 1].pct += rest - scaled.reduce((s, p) => s + p.pct, 0);
    const next = [...scaled];
    next.splice(index, 0, { ...parts[index], pct });
    onChange(next);
  };

  const setFlour = (index: number, id: string) =>
    onChange(parts.map((p, i) => (i === index ? { ...p, id } : p)));

  const add = () => {
    if (parts.length >= MAX_FLOURS) return;
    // The flour most often added to a blend: Manitoba to strengthen a pizza
    // flour, a strong wheat for bread.
    const preferred = pizza ? 'caputo_manitoba' : 'bread_high';
    const id = parts.some((p) => p.id === preferred)
      ? (FLOURS.find((f) => !parts.some((p) => p.id === f.id)) ?? FLOURS[0]).id
      : preferred;
    const scaled = parts.map((p) => ({ ...p, pct: Math.round((p.pct / sum) * 80) }));
    scaled[0].pct += 80 - scaled.reduce((s, p) => s + p.pct, 0);
    onChange([...scaled, { id, pct: 20 }]);
  };

  const remove = (index: number) => {
    const rest = parts.filter((_, i) => i !== index);
    const restSum = rest.reduce((s, p) => s + p.pct, 0) || 1;
    const scaled = rest.map((p) => ({ ...p, pct: Math.round((p.pct / restSum) * 100) }));
    scaled[0].pct += 100 - scaled.reduce((s, p) => s + p.pct, 0);
    onChange(scaled);
  };

  return (
    <Card className="p-5" data-print-card>
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wheat className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-base font-semibold">{t('params.flour')}</h3>
        </div>
        {blend !== null && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{t('flour.reset')}</span>
          </Button>
        )}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('flour.lead')}</p>

      <ul className="space-y-3">
        {parts.map((part, index) => (
          <li key={`${part.id}-${index}`} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Select value={part.id} onValueChange={(id) => setFlour(index, id)}>
                <SelectTrigger aria-label={t('flour.which', { n: index + 1 })}>
                  {/* The name alone: the strength figures belong in the list. */}
                  <SelectValue>{name(part.id)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FLOUR_GROUPS.map((group) => (
                    <SelectGroup key={group}>
                      <SelectLabel>{t(`flourGroup.${group}`)}</SelectLabel>
                      {FLOURS.filter((f) => f.use === group).map((f) => (
                        <SelectItem
                          key={f.id}
                          value={f.id}
                          disabled={f.id !== part.id && parts.some((p) => p.id === f.id)}
                        >
                          {name(f.id)}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {f.w
                              ? `W ${f.w[0] === f.w[1] ? f.w[0] : `${f.w[0]}–${f.w[1]}`} · `
                              : ''}
                            {formatNumber(f.proteinPct, lang)}%
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative w-24 shrink-0">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={5}
                value={Math.round(part.pct)}
                disabled={parts.length === 1}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) setShare(index, value);
                }}
                aria-label={t('flour.share', { name: name(part.id) })}
                className="pr-7 text-right tabular"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              disabled={parts.length === 1}
              aria-label={t('flour.remove', { name: name(part.id) })}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      {parts.length < MAX_FLOURS && (
        <Button variant="outline" size="sm" onClick={add} className="mt-3 gap-1.5">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('flour.add')}
        </Button>
      )}

      {advice && <FlourStrength advice={advice} onUse={onChange} />}
    </Card>
  );
}

/**
 * The blend's strength against the plan, in words a baker acts on, with the
 * suggestions one click away.
 */
export function FlourStrength({
  advice,
  onUse,
}: {
  advice: FlourAdvice;
  onUse?: (blend: BlendPart[]) => void;
}) {
  const { t, lang } = useI18n();
  const n = (value: number, decimals = 1) => formatNumber(value, lang, decimals);
  const name = (id: string) => t(flourKey(id));
  const describe = (parts: BlendPart[]) =>
    parts.length === 1
      ? name(parts[0].id)
      : parts.map((p) => `${n(p.pct, 0)}% ${name(p.id)}`).join(' + ');

  const fitKey =
    advice.minProteinPct !== undefined ? 'flour.fit.weakProtein' : `flour.fit.${advice.fit}`;
  const tone =
    advice.fit === 'weak'
      ? 'border-warning/40 bg-warning/10'
      : advice.fit === 'edge'
        ? 'border-border bg-muted'
        : 'border-border bg-card';

  return (
    <div className="mt-5 space-y-3 text-sm">
      <p className="tabular">
        <span className="font-semibold">
          {t(advice.wEstimated ? 'flour.strengthEstimated' : 'flour.strength', {
            protein: n(advice.proteinPct),
            w: advice.w !== undefined ? n(advice.w, 0) : '–',
          })}
        </span>
        {advice.specialtyPct > 0 && (
          <span className="text-muted-foreground"> · {t('flour.specialty', { pct: n(advice.specialtyPct, 0) })}</span>
        )}
      </p>

      <p className="text-muted-foreground">
        {t('flour.plan', { hours: n(advice.maturationHours), w: n(advice.recommendedW, 0) })}
      </p>

      <p className={cn('rounded-lg border px-3 py-2 leading-relaxed', tone)}>
        {t(fitKey, {
          w: advice.w !== undefined ? n(advice.w, 0) : '–',
          optimum: n(advice.optimumHours ?? 0, 0),
          protein: n(advice.proteinPct),
          min: n(advice.minProteinPct ?? 0),
        })}
      </p>

      {advice.suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('flour.suggest')}
          </p>
          <ul className="space-y-2">
            {advice.suggestions.map((s) => (
              <li
                key={s.parts.map((p) => `${p.id}${p.pct}`).join('-')}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2"
              >
                <span>
                  <span className="font-semibold">{describe(s.parts)}</span>
                  <span className="ml-2 text-xs tabular text-muted-foreground">
                    {t('flour.suggestion.w', { w: n(s.w, 0) })}
                  </span>
                </span>
                {onUse && (
                  <Button size="sm" variant="outline" onClick={() => onUse(s.parts)}>
                    {t('flour.use')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">{t('flour.source')}</p>
    </div>
  );
}
