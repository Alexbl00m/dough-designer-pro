import { useState } from 'react';
import { Check, Copy, Download, Link2, Printer, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IngredientTable } from '@/components/recipe/IngredientTable';
import { RecipeTimeline } from '@/components/recipe/RecipeTimeline';
import { DoughTempCard } from '@/components/recipe/DoughTempCard';
import { YeastExplainer } from '@/components/recipe/YeastExplainer';
import { SourdoughPanel } from '@/components/recipe/SourdoughPanel';
import { NotesList } from '@/components/recipe/NotesList';
import { FlourAdvisor } from '@/components/recipe/FlourAdvisor';
import type { BreadStyle } from '@/data/styles';
import type { CalculationResults } from '@/core/types';
import { useI18n } from '@/i18n';
import { formatClock, formatGrams, formatNumber } from '@/lib/format';
import {
  copyToClipboard,
  downloadText,
  recipeFilename,
  recipeToText,
} from '@/lib/recipe/export';

interface RecipeResultsProps {
  style: BreadStyle;
  results: CalculationResults;
  startIso: string;
  shareUrl: string;
  onSave: () => void;
  saved: boolean;
}

export function RecipeResults({
  style,
  results,
  startIso,
  shareUrl,
  onSave,
  saved,
}: RecipeResultsProps) {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState<'text' | 'link' | null>(null);

  const n = (value: number, decimals = 1) => formatNumber(value, lang, decimals);
  const pieceUnit =
    style.category === 'pizza'
      ? results.totals.pieces === 1
        ? 'unit.ball'
        : 'unit.balls'
      : results.totals.pieces === 1
        ? 'unit.loaf'
        : 'unit.loaves';

  const flash = (which: 'text' | 'link') => {
    setCopied(which);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyText = async () => {
    const text = recipeToText(style, results, t, lang, shareUrl);
    if (await copyToClipboard(text)) flash('text');
  };

  const handleCopyLink = async () => {
    if (await copyToClipboard(shareUrl)) flash('link');
  };

  const handleDownload = () => {
    downloadText(recipeFilename(style.name), recipeToText(style, results, t, lang, shareUrl));
  };

  const preferment = results.sections.find((s) => s.id === 'preferment');

  return (
    <div className="space-y-4">
      {/* ── Headline ── */}
      <Card className="bg-gradient-to-br from-primary-soft to-card p-5" data-print-card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">{style.name}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t('recipe.for', {
                count: results.totals.pieces,
                weight: formatGrams(results.totals.perPiece, lang),
                unit: t(pieceUnit),
              })}
            </p>
          </div>
          <Badge variant="secondary" className="tabular">
            {t('recipe.readyAt', { time: formatClock(results.readyAt, lang) })}
          </Badge>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={t('recipe.totalFlour')} value={`${formatGrams(results.totals.flour, lang)} g`} />
          <Stat
            label={t('recipe.totalDough')}
            value={`${formatGrams(results.totals.doughWeight, lang)} g`}
          />
          <Stat label={t('recipe.waterTemp')} value={`${n(results.water.tempC)} °C`} />
          <Stat
            label={t('recipe.trueHydration')}
            value={`${n(results.totals.trueHydrationPct)}%`}
          />
        </dl>
      </Card>

      {/* ── Actions ── */}
      <div className="no-print flex flex-wrap gap-2">
        <Button onClick={onSave} variant={saved ? 'secondary' : 'default'} className="gap-2">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? t('action.saved') : t('action.save')}
        </Button>
        <Button onClick={handleCopyLink} variant="outline" className="gap-2">
          {copied === 'link' ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {copied === 'link' ? t('action.shared') : t('action.share')}
        </Button>
        <Button onClick={handleCopyText} variant="outline" className="gap-2">
          {copied === 'text' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied === 'text' ? t('action.copied') : t('action.copy')}
        </Button>
        <Button onClick={handleDownload} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">{t('action.download')}</span>
        </Button>
        <Button onClick={() => window.print()} variant="outline" className="gap-2">
          <Printer className="h-4 w-4" />
          <span className="hidden sm:inline">{t('action.print')}</span>
        </Button>
      </div>

      {/* ── Ingredients ── */}
      <section className="space-y-3" aria-label={t('recipe.ingredients')}>
        {results.sections.map((section) => (
          <IngredientTable
            key={section.id}
            section={section}
            subdued={section.id !== 'final'}
            percentBasis={results.params.percentBasis}
          />
        ))}
      </section>

      {/* ── Process ── */}
      <div className="print-grid grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DoughTempCard
          water={results.water}
          doughTemp={results.water.desiredDoughTempC}
          roomTempC={results.fermentation.roomTempC}
          prefermentTempC={preferment?.meta?.tempC}
        />
        <FermentationCard results={results} />
      </div>

      <div className="print-grid grid grid-cols-1 gap-4 lg:grid-cols-2">
        <YeastExplainer style={style} results={results} />
        <FlourAdvisor style={style} effectiveHours={results.fermentation.roomEquivHours} />
      </div>

      <SourdoughPanel
        fermentation={results.fermentation}
        starterHydration={results.params.starterHydration}
        totalFlour={results.totals.flour}
      />

      {/* ── Timeline ── */}
      <Card className="p-5" data-print-card>
        <h4 className="mb-4 font-semibold">{t('recipe.timeline')}</h4>
        <RecipeTimeline steps={results.timeline} startIso={startIso} />
      </Card>

      <NotesList notes={results.notes} />

      <p className="print-only pt-4 text-xs text-muted-foreground">
        {t('recipe.printedBy')} — {shareUrl}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="stat-label">{label}</dt>
      <dd className="stat-value">{value}</dd>
    </div>
  );
}

function FermentationCard({ results }: { results: CalculationResults }) {
  const { t, lang } = useI18n();
  const f = results.fermentation;
  const n = (value: number, decimals = 1) => formatNumber(value, lang, decimals);

  return (
    <Card className="p-5" data-print-card>
      <h4 className="mb-4 font-semibold">{t('params.fermentation')}</h4>
      <dl className="grid grid-cols-2 gap-4">
        <Stat label={t('recipe.bulk')} value={`${n(f.bulkHours)} h`} />
        <Stat label={t('recipe.proof')} value={`${n(f.proofHours)} h`} />
        {f.coldHours > 0 && (
          <Stat
            label={t('recipe.coldRetard')}
            value={`${n(f.coldHours)} h · ${n(f.coldTempC)} °C`}
          />
        )}
        <Stat label={t('recipe.roomEquiv')} value={`${n(f.roomEquivHours)} h`} />
        {f.inoculationPct > 0 && (
          <Stat label={t('recipe.inoculation')} value={`${n(f.levainOnFlourPct)}%`} />
        )}
        {f.yeastPct > 0 && (
          <Stat
            label={t('recipe.yeast')}
            value={`${formatNumber(f.yeastPct, lang, 3)}%`}
          />
        )}
      </dl>
    </Card>
  );
}
