import { Check, ChevronDown, Copy, Download, Link2, Printer, Save, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IngredientTable } from '@/components/recipe/IngredientTable';
import { RecipeTimeline } from '@/components/recipe/RecipeTimeline';
import { DoughTempCard } from '@/components/recipe/DoughTempCard';
import { FermentationClock } from '@/components/recipe/FermentationClock';
import { YeastClock } from '@/components/recipe/YeastClock';
import { PlanWarnings } from '@/components/PlanCard';
import { SourdoughPanel } from '@/components/recipe/SourdoughPanel';
import { NotesList } from '@/components/recipe/NotesList';
import { FlourAdvisor } from '@/components/recipe/FlourAdvisor';
import type { BreadStyle } from '@/data/styles';
import type { CalculationResults } from '@/core/types';
import type { PlanState } from '@/lib/recipe/plan';
import { useI18n } from '@/i18n';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime, formatGrams, formatNumber, formatYeastPct } from '@/lib/format';
import {
  copyToClipboard,
  downloadText,
  recipeFilename,
  recipeToText,
} from '@/lib/recipe/export';

interface RecipeResultsProps {
  style: BreadStyle;
  results: CalculationResults;
  /** Lets the plan warnings fix the plan from here, without a trip back. */
  onPlanChange: (plan: PlanState) => void;
  shareUrl: string;
  onSave: () => void;
  saved: boolean;
}

export function RecipeResults({
  style,
  results,
  onPlanChange,
  shareUrl,
  onSave,
  saved,
}: RecipeResultsProps) {
  const { t, lang } = useI18n();
  const { toast } = useToast();

  const n = (value: number, decimals = 1) => formatNumber(value, lang, decimals);

  const handleCopyText = async () => {
    const text = recipeToText(style, results, t, lang, shareUrl);
    if (await copyToClipboard(text)) toast({ description: t('action.copied') });
  };

  const handleCopyLink = async () => {
    if (await copyToClipboard(shareUrl)) toast({ description: t('action.shared') });
  };

  const handleDownload = () => {
    downloadText(recipeFilename(style.name), recipeToText(style, results, t, lang, shareUrl));
  };

  const preferment = results.sections.find((s) => s.id === 'preferment');

  return (
    <div className="space-y-4">
      {/* ── Headline: the page heading names the recipe, this card says when and how much ── */}
      <Card className="bg-primary-soft p-5" data-print-card>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="tabular">
            {t('recipe.startAt', { time: formatDateTime(results.plan.startsAt, lang) })}
          </Badge>
          <Badge variant="secondary" className="tabular">
            {t('recipe.readyAt', { time: formatDateTime(results.readyAt, lang) })}
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

      <div className="no-print">
        <PlanWarnings
          results={results}
          plan={{ mode: results.plan.mode === 'start' ? 'start' : 'ready', at: null }}
          onPlanChange={onPlanChange}
        />
      </div>

      {/* ── Actions: one to keep the recipe, one menu for every way it leaves the app ── */}
      <div className="no-print flex flex-wrap gap-2">
        <Button onClick={onSave} variant={saved ? 'secondary' : 'default'} className="gap-2">
          {saved ? <Check className="h-4 w-4" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {saved ? t('action.saved') : t('action.save')}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Share2 className="h-4 w-4" aria-hidden />
              {t('action.shareMenu')}
              <ChevronDown className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={handleCopyLink} className="gap-2">
              <Link2 className="h-4 w-4" aria-hidden />
              {t('action.share')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleCopyText} className="gap-2">
              <Copy className="h-4 w-4" aria-hidden />
              {t('action.copy')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleDownload} className="gap-2">
              <Download className="h-4 w-4" aria-hidden />
              {t('action.download')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => window.print()} className="gap-2">
              <Printer className="h-4 w-4" aria-hidden />
              {t('action.print')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
          prefermentTempC={results.preferment?.mixTempC ?? preferment?.meta?.tempC}
        />
        <FermentationCard results={results} />
      </div>

      <div className="print-grid grid grid-cols-1 gap-4 lg:grid-cols-2">
        {results.fermentation.leavenType === 'commercial' ? (
          <YeastClock results={results} />
        ) : (
          <FermentationClock results={results} />
        )}
        <FlourAdvisor advice={results.flour} />
      </div>

      <SourdoughPanel
        fermentation={results.fermentation}
        starterHydration={results.params.starterHydration}
        totalFlour={results.totals.flour}
        salt={results.params.salt}
        hydration={results.params.hydration}
      />

      {/* ── Timeline ── */}
      <Card className="p-5" data-print-card>
        <h2 className="mb-4 text-display-sm">{t('recipe.timeline')}</h2>
        <RecipeTimeline steps={results.timeline} />
      </Card>

      <NotesList notes={results.notes} />

      <p className="print-only pt-4 text-xs text-muted-foreground">
        {t('recipe.printedBy')}: {shareUrl}
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
      <h2 className="mb-4 text-display-sm">{t('params.fermentation')}</h2>
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
        {f.totalYeastPct > 0 && (
          <Stat
            label={t('recipe.yeastTotal')}
            value={`${formatYeastPct(f.totalYeastPct, lang)}%`}
          />
        )}
      </dl>
    </Card>
  );
}
