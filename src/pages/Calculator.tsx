import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/AppSidebar';
import type { Section } from '@/components/AppSidebar';
import { StyleSelector } from '@/components/StyleSelector';
import { CalculatorInputs } from '@/components/CalculatorInputs';
import { RecipeResults } from '@/components/RecipeResults';
import { getStyleById, pieceUnitKey } from '@/data/styles';
import { round } from '@/core/constants';
import type { CalculationResults, FermentDriver } from '@/core/types';
import {
  paramsForStyle,
  paramsToInputs,
  paramsToQuery,
  queryToParams,
} from '@/lib/recipe/state';
import type { RecipeParams } from '@/lib/recipe/state';
import { DEFAULT_PLAN, calculateWithPlan } from '@/lib/recipe/plan';
import type { PlanState } from '@/lib/recipe/plan';
import { saveBake } from '@/lib/recipe/storage';
import { useI18n, useT } from '@/i18n';
import { useToast } from '@/hooks/use-toast';
import { formatGrams } from '@/lib/format';
import { cn } from '@/lib/utils';

const SECTION_ORDER: Section[] = ['styles', 'parameters', 'recipe'];

export default function Calculator() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // A link carries the whole recipe, so an incoming URL wins over the defaults.
  const [params, setParams] = useState<RecipeParams | null>(() =>
    queryToParams(searchParams.toString()),
  );
  const [section, setSection] = useState<Section>(() =>
    queryToParams(searchParams.toString()) ? 'recipe' : 'styles',
  );

  // The plan is pinned to a moment the baker chooses — by default the first
  // six o'clock the recipe can still make. "Now" ticks once a minute, so a
  // page left open never offers a start that has already passed.
  const [plan, setPlan] = useState<PlanState>(DEFAULT_PLAN);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Moving between steps puts the reader at the top of the new step, not
  // wherever they were in the previous one. The window is what scrolls (the
  // layout grows with its content), and focus moves to the new step's heading
  // so a screen reader announces where it landed.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepped = useRef(false);
  const goToSection = useCallback((next: Section) => {
    setSection(next);
    stepped.current = true;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, []);
  useEffect(() => {
    if (!stepped.current) return;
    stepped.current = false;
    headingRef.current?.focus({ preventScroll: true });
  }, [section]);

  const style = params ? getStyleById(params.styleId) : undefined;

  // Keep the URL in step with the parameters so the address bar is always
  // shareable — replace, not push, so the back button still leaves the page.
  useEffect(() => {
    if (!params) return;
    const query = paramsToQuery(params);
    if (query !== searchParams.toString()) {
      setSearchParams(query, { replace: true });
    }
  }, [params, searchParams, setSearchParams]);

  const handleStyleSelect = useCallback((styleId: string) => {
    const selected = getStyleById(styleId);
    if (!selected) return;
    // Every style brings its own sensible batch size and timing; carrying the
    // previous style's 265 g pizza balls over to a sourdough loaf is a bug.
    setParams(paramsForStyle(selected));
    setSavedId(null);
    goToSection('parameters');
  }, [goToSection]);

  const handleParamChange = useCallback(
    <K extends keyof RecipeParams>(key: K, value: RecipeParams[K]) => {
      setParams((current) => {
        if (!current) return current;
        const next = { ...current, [key]: value };
        // Cold time can never outlast the ferment it sits inside.
        if (next.coldHours > next.totalTime) next.coldHours = next.totalTime;
        if (next.prefermentColdHours > next.prefermentHours) {
          next.prefermentColdHours = next.prefermentHours;
        }
        return next;
      });
      setSavedId(null);
    },
    [],
  );

  const handleReset = useCallback(() => {
    if (!style) return;
    setParams(paramsForStyle(style));
    setSavedId(null);
    toast({ description: t('params.resetDone') });
  }, [style, t, toast]);

  const results: CalculationResults | null = useMemo(() => {
    if (!style || !params) return null;
    try {
      return calculateWithPlan(paramsToInputs(style, params), plan, now);
    } catch (error) {
      console.error('Recipe calculation failed', error);
      return null;
    }
  }, [style, params, plan, now]);

  // Switching which end of the clock the baker holds must not move the recipe:
  // the new driving value starts where the old one had put it.
  const handleDriverChange = useCallback(
    (driver: FermentDriver) => {
      setParams((current) => {
        if (!current) return current;
        const next = { ...current, driver };
        if (results) {
          const f = results.fermentation;
          if (driver === 'dose') {
            if (current.leavenType === 'commercial') next.yeastPct = round(f.freshYeastPct, 4);
            else next.leavenPct = round(f.starterEquivalentPct, 1);
          } else {
            next.totalTime = Math.max(1, Math.round(f.totalHours * 2) / 2);
          }
        }
        return next;
      });
      setSavedId(null);
    },
    [results],
  );

  const shareUrl = useMemo(() => {
    if (!params) return '';
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}?${paramsToQuery(params)}`;
  }, [params]);

  const handleSave = useCallback(() => {
    if (!params || !style) return;
    const entry = saveBake(style.name, params);
    setSavedId(entry.id);
    toast({ description: t('action.saved') });
  }, [params, style, t, toast]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar
          currentSection={section}
          onSectionChange={goToSection}
          hasStyle={Boolean(style)}
          styleName={style?.name}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader context={style?.name} />

          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <div className="mx-auto w-full max-w-5xl">
              <StepNav current={section} hasStyle={Boolean(style)} onSelect={goToSection} />

              {section === 'styles' && (
                <section aria-labelledby="section-heading">
                  <header className="mb-6">
                    <h1
                      id="section-heading"
                      ref={headingRef}
                      tabIndex={-1}
                      className="text-display-md outline-none"
                    >
                      {t('styles.title')}
                    </h1>
                    <p className="mt-1 text-muted-foreground">{t('styles.lead')}</p>
                  </header>
                  <StyleSelector
                    selectedStyle={params?.styleId ?? null}
                    onStyleSelect={handleStyleSelect}
                  />
                </section>
              )}

              {section === 'parameters' && style && params && (
                <section aria-labelledby="section-heading">
                  <header className="mb-6">
                    <h1
                      id="section-heading"
                      ref={headingRef}
                      tabIndex={-1}
                      className="text-display-md outline-none"
                    >
                      {t('params.title')}
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                      {t('params.lead', { name: style.name })}
                    </p>
                  </header>

                  <CalculatorInputs
                    style={style}
                    params={params}
                    results={results}
                    onChange={handleParamChange}
                    onDriverChange={handleDriverChange}
                    onReset={handleReset}
                    plan={plan}
                    onPlanChange={setPlan}
                  />

                  <div className="no-print mt-6 flex flex-wrap gap-3">
                    <Button variant="outline" onClick={() => goToSection('styles')} className="gap-2">
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                      {t('nav.back')}
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => goToSection('recipe')}
                      className="flex-1 gap-2 sm:flex-none"
                    >
                      {t('action.showRecipe')}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </section>
              )}

              {section === 'recipe' && style && params && results && (
                <section aria-labelledby="section-heading">
                  <header className="mb-6">
                    {/* The recipe is named for what it makes; the step needs no title of its own. */}
                    <h1
                      id="section-heading"
                      ref={headingRef}
                      tabIndex={-1}
                      className="text-display-md outline-none"
                    >
                      {style.name}
                    </h1>
                    <p className="mt-1 tabular text-muted-foreground">
                      {t('recipe.for', {
                        count: results.totals.pieces,
                        weight: formatGrams(results.totals.perPiece, lang),
                        unit: t(pieceUnitKey(style, results.totals.pieces)),
                      })}
                    </p>
                  </header>

                  <RecipeResults
                    style={style}
                    results={results}
                    onPlanChange={setPlan}
                    shareUrl={shareUrl}
                    onSave={handleSave}
                    saved={savedId !== null}
                  />

                  <div className="no-print mt-6">
                    <Button
                      variant="outline"
                      onClick={() => goToSection('parameters')}
                      className="gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                      {t('nav.parameters')}
                    </Button>
                  </div>
                </section>
              )}

              {section === 'recipe' && style && params && !results && (
                <div className="surface p-8 text-center">
                  <h2 className="text-lg font-semibold">{t('error.title')}</h2>
                  <p className="mt-2 text-muted-foreground">{t('error.body')}</p>
                  <Button className="mt-4" onClick={handleReset}>
                    {t('params.reset')}
                  </Button>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

const STEP_LABEL: Record<Section, string> = {
  styles: 'nav.styles',
  parameters: 'nav.parameters',
  recipe: 'nav.recipe',
};

/**
 * The three steps by name, so the baker can see where they are and go back.
 * The sidebar carries them on a wide screen; when it is closed, or on a phone
 * where it is a drawer, this row does.
 */
function StepNav({
  current,
  hasStyle,
  onSelect,
}: {
  current: Section;
  hasStyle: boolean;
  onSelect: (section: Section) => void;
}) {
  const t = useT();
  const { isMobile, open } = useSidebar();
  if (!isMobile && open) return null;

  return (
    <nav aria-label={t('nav.steps')} className="no-print mb-5">
      <ol className="inline-flex max-w-full gap-1 rounded-lg bg-muted p-1">
        {SECTION_ORDER.map((step) => {
          const active = step === current;
          return (
            <li key={step}>
              <button
                type="button"
                onClick={() => onSelect(step)}
                disabled={step !== 'styles' && !hasStyle}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'pressable rounded-md px-3 py-1.5 text-caption transition-colors disabled:opacity-40',
                  active
                    ? 'bg-card font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(STEP_LABEL[step])}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
