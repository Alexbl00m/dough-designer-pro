import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/AppSidebar';
import type { Section } from '@/components/AppSidebar';
import { StyleSelector } from '@/components/StyleSelector';
import { CalculatorInputs } from '@/components/CalculatorInputs';
import { RecipeResults } from '@/components/RecipeResults';
import { getStyleById } from '@/data/styles';
import { calculateRecipe } from '@/core/calculations';
import type { CalculationResults } from '@/core/types';
import {
  paramsForStyle,
  paramsToQuery,
  queryToParams,
} from '@/lib/recipe/state';
import type { RecipeParams } from '@/lib/recipe/state';
import { saveBake } from '@/lib/recipe/storage';
import { useT } from '@/i18n';
import { useToast } from '@/hooks/use-toast';

const SECTION_ORDER: Section[] = ['styles', 'parameters', 'recipe'];

export default function Calculator() {
  const t = useT();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // A link carries the whole recipe, so an incoming URL wins over the defaults.
  const [params, setParams] = useState<RecipeParams | null>(() =>
    queryToParams(searchParams.toString()),
  );
  const [section, setSection] = useState<Section>(() =>
    queryToParams(searchParams.toString()) ? 'recipe' : 'styles',
  );

  // The schedule needs a concrete start; "now" is picked once so the timeline
  // does not shift under the baker on every keystroke.
  const [startTime, setStartTime] = useState(() => roundToNextQuarter(new Date()));
  const [savedId, setSavedId] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);

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
    setSection('parameters');
  }, []);

  const handleParamChange = useCallback(
    <K extends keyof RecipeParams>(key: K, value: RecipeParams[K]) => {
      setParams((current) => {
        if (!current) return current;
        const next = { ...current, [key]: value };
        // Cold time can never outlast the ferment it sits inside.
        if (next.coldHours > next.totalTime) next.coldHours = next.totalTime;
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
      return calculateRecipe({
        style,
        scaleMode: params.scaleMode,
        ballWeight: params.ballWeight,
        ballCount: params.ballCount,
        targetFlour: params.targetFlour,
        targetDough: params.targetDough,
        driver: params.driver,
        totalTime: params.totalTime,
        leavenPct: params.leavenPct,
        roomTemp: params.roomTemp,
        coldTemp: params.coldTemp,
        coldHours: params.coldHours,
        coldPhase: params.coldPhase,
        hydration: params.hydration,
        salt: params.salt,
        sugar: params.sugar,
        oil: params.oil,
        leavenType: params.leavenType,
        yeastForm: params.yeastForm,
        mixing: params.mixing,
        desiredDoughTemp: params.doughTemp,
        flourTemp: params.flourTemp ?? undefined,
        starterHydration: params.starterHydration,
        percentBasis: params.percentBasis,
        usePreferment: params.usePreferment,
        startTime,
      });
    } catch (error) {
      console.error('Recipe calculation failed', error);
      return null;
    }
  }, [style, params, startTime]);

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

  // Moving between steps should put the reader at the top of the new step,
  // not wherever they happened to be scrolled in the previous one.
  const goToSection = useCallback((next: Section) => {
    setSection(next);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const index = SECTION_ORDER.indexOf(section);

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

          <main ref={mainRef} className="flex-1 overflow-auto p-4 sm:p-6">
            <div className="mx-auto w-full max-w-5xl">
              <p className="no-print mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('nav.step', { n: index + 1, total: SECTION_ORDER.length })}
              </p>

              {section === 'styles' && (
                <section aria-labelledby="section-heading">
                  <header className="mb-6">
                    <h2 id="section-heading" className="text-display-md">
                      {t('styles.title')}
                    </h2>
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
                    <h2 id="section-heading" className="text-display-md">
                      {t('params.title')}
                    </h2>
                    <p className="mt-1 text-muted-foreground">
                      {t('params.lead', { name: style.name })}
                    </p>
                  </header>

                  <CalculatorInputs
                    style={style}
                    params={params}
                    computed={{
                      totalHours: results?.fermentation.totalHours ?? params.totalTime,
                      leavenPct: results?.fermentation.starterEquivalentPct ?? params.leavenPct,
                    }}
                    onChange={handleParamChange}
                    onReset={handleReset}
                    startTime={startTime}
                    onStartTimeChange={setStartTime}
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
                    <h2 id="section-heading" className="text-display-md">
                      {t('recipe.title')}
                    </h2>
                    <p className="mt-1 text-muted-foreground">{t('app.tagline')}</p>
                  </header>

                  <RecipeResults
                    style={style}
                    results={results}
                    startIso={startTime.toISOString()}
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

/** Bakers think in quarter hours, not in "14:37". */
function roundToNextQuarter(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(Math.ceil(rounded.getMinutes() / 15) * 15);
  return rounded;
}
