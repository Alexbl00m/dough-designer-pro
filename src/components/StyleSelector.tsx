import { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BREAD_STYLES, STYLE_CATEGORIES, getFlourBlendText } from '@/data/styles';
import type { BreadStyle, StyleCategory } from '@/data/styles';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

interface StyleSelectorProps {
  selectedStyle: string | null;
  onStyleSelect: (styleId: string) => void;
}

type Filter = StyleCategory | 'all';

export function StyleSelector({ selectedStyle, onStyleSelect }: StyleSelectorProps) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return BREAD_STYLES.filter((style) => {
      if (filter !== 'all' && style.category !== filter) return false;
      if (!needle) return true;
      // Search everything a baker might type: the name, where it's from, the
      // flours, and the characteristic bullets.
      const haystack = [
        style.name,
        t(style.regionKey),
        t(`style.${style.id}.desc`),
        getFlourBlendText(style.flourBlend, t),
        ...Array.from({ length: style.characteristicCount }, (_, i) =>
          t(`style.${style.id}.char.${i}`),
        ),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, filter, t]);

  const grouped = useMemo(() => {
    const map = new Map<StyleCategory, BreadStyle[]>();
    for (const style of matches) {
      const list = map.get(style.category) ?? [];
      list.push(style);
      map.set(style.category, list);
    }
    return map;
  }, [matches]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('styles.search')}
            aria-label={t('styles.search')}
            className="pl-9 pr-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('styles.clear')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="shrink-0 text-sm text-muted-foreground" aria-live="polite">
          {t('styles.count', { n: matches.length })}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('category.all')}>
        {(['all', ...STYLE_CATEGORIES] as Filter[]).map((category) => (
          <Button
            key={category}
            variant={filter === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(category)}
            aria-pressed={filter === category}
          >
            {t(`category.${category}`)}
          </Button>
        ))}
      </div>

      {matches.length === 0 && (
        <div className="surface p-8 text-center">
          <p className="text-muted-foreground">{t('styles.empty', { query })}</p>
          <Button
            variant="link"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
          >
            {t('styles.clear')}
          </Button>
        </div>
      )}

      {STYLE_CATEGORIES.map((category) => {
        const styles = grouped.get(category);
        if (!styles?.length) return null;
        return (
          <section key={category} aria-labelledby={`cat-${category}`}>
            <h3
              id={`cat-${category}`}
              className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {t(`category.${category}`)}
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {styles.map((style) => (
                <StyleCard
                  key={style.id}
                  style={style}
                  selected={selectedStyle === style.id}
                  onSelect={() => onStyleSelect(style.id)}
                  t={t}
                  lang={lang}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

interface StyleCardProps {
  style: BreadStyle;
  selected: boolean;
  onSelect: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  lang: 'sv' | 'en';
}

function StyleCard({ style, selected, onSelect, t, lang }: StyleCardProps) {
  const characteristics = Array.from({ length: style.characteristicCount }, (_, i) =>
    t(`style.${style.id}.char.${i}`),
  );

  return (
    // A real <button> so the card is reachable by keyboard and announced as a
    // control — the previous div-with-onClick was invisible to assistive tech.
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={t('styles.select', { name: style.name })}
      className={cn(
        'surface pressable group flex h-full flex-col gap-3 p-5 text-left',
        'transition-colors duration-150 hover:border-primary/40 hover:bg-card-muted',
        selected && 'border-primary bg-primary-soft',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-display-sm leading-tight">{style.name}</h4>
        {selected ? (
          <Badge className="shrink-0 gap-1">
            <Check className="h-3 w-3" aria-hidden />
            {t('styles.selected')}
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 text-xs font-normal">
            {t(style.regionKey)}
          </Badge>
        )}
      </div>

      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
        {t(`style.${style.id}.desc`)}
      </p>

      {style.flourBlend && (
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{t('styles.blend')}:</span>{' '}
          {getFlourBlendText(style.flourBlend, t)}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-xs tabular">
          {t('styles.hydration', { n: formatNumber(style.defaultParams.hydration_pct, lang) })}
        </Badge>
        <Badge variant="secondary" className="text-xs tabular">
          {t('styles.salt', { n: formatNumber(style.defaultParams.salt_pct, lang) })}
        </Badge>
        <Badge variant="secondary" className="text-xs tabular">
          {t('styles.time', { n: formatNumber(style.defaults.totalTime, lang) })}
        </Badge>
        {style.preferment && (
          <Badge variant="outline" className="text-xs capitalize">
            {style.preferment.type}
          </Badge>
        )}
        {style.defaults.leavenType === 'sourdough' && (
          <Badge variant="outline" className="text-xs">
            {t('field.leaven.sourdough')}
          </Badge>
        )}
      </div>

      <ul className="flex flex-wrap gap-1">
        {characteristics.map((char) => (
          <li
            key={char}
            className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
          >
            {char}
          </li>
        ))}
      </ul>
    </button>
  );
}
