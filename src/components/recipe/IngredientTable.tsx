import { Badge } from '@/components/ui/badge';
import type { RecipeSection } from '@/core/types';
import { useI18n } from '@/i18n';
import { formatGrams, formatPercent, formatSectionMeta } from '@/lib/format';
import { cn } from '@/lib/utils';

interface IngredientTableProps {
  section: RecipeSection;
  /** Preferments and levains get a lighter treatment than the final dough. */
  subdued?: boolean;
  /** Named in the column header, because the two bases give different numbers. */
  percentBasis: 'total' | 'dough';
}

export function IngredientTable({ section, subdued, percentBasis }: IngredientTableProps) {
  const { t, lang } = useI18n();

  return (
    <div
      className={cn(
        'surface overflow-hidden',
        subdued && 'border-dashed bg-card-muted',
      )}
      data-print-card
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-display-sm">{t(section.titleKey)}</h2>
        <div className="flex items-center gap-2">
          {section.meta && (
            <Badge variant="outline" className="text-xs font-normal tabular">
              {formatSectionMeta(section.meta, t)}
            </Badge>
          )}
          <span className="text-sm tabular text-muted-foreground">
            {t('recipe.sectionTotal', { grams: formatGrams(section.totalGrams, lang) })}
          </span>
        </div>
      </div>

      <table className="w-full text-sm">
        <caption className="sr-only">{t(section.titleKey)}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">{t('recipe.ingredient')}</th>
            <th scope="col">{t('recipe.grams')}</th>
            <th scope="col">
              {t(percentBasis === 'dough' ? 'recipe.percentDough' : 'recipe.percentTotal')}
            </th>
          </tr>
        </thead>
        <tbody>
          {section.ingredients.map((ingredient) => (
            <tr
              key={`${ingredient.key}-${ingredient.grams}`}
              className="border-b border-border/60 last:border-0"
            >
              <th
                scope="row"
                className="px-4 py-2.5 text-left font-normal sm:px-5"
              >
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span>{t(ingredient.key)}</span>
                  {ingredient.note && (
                    <span className="text-xs font-normal text-muted-foreground">
                      ({t(ingredient.note)})
                    </span>
                  )}
                </span>
              </th>
              <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold tabular">
                {formatGrams(ingredient.grams, lang)} g
              </td>
              <td className="w-20 whitespace-nowrap px-4 py-2.5 text-right tabular text-muted-foreground sm:px-5">
                {formatPercent(ingredient.percentage, lang)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
