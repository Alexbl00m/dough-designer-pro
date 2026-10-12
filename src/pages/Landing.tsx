import { useMemo } from 'react';
import { ArrowRight, ChefHat } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LanguageToggle, ThemeToggle } from '@/components/layout/AppHeader';
import { RecipeTimeline } from '@/components/recipe/RecipeTimeline';
import { BREAD_STYLES, getStyleById, pieceUnitKey } from '@/data/styles';
import type { BreadStyle } from '@/data/styles';
import type { CalculationResults, TimelineStep } from '@/core/types';
import { useI18n } from '@/i18n';
import { formatDateTime, formatGrams, formatNumber } from '@/lib/format';
import { DEFAULT_PLAN, calculateWithPlan } from '@/lib/recipe/plan';
import { paramsForStyle, paramsToInputs, paramsToQuery } from '@/lib/recipe/state';
import heroBakery from '@/assets/hero-bakery.jpg';

/** The style the page shows working: the one the plan was rebuilt around. */
const EXAMPLE_STYLE_ID = 'pizza_poolish';

/** Folds and shaping crowd a preview; the moments a baker plans a day around stay. */
const PREVIEW_SKIP = new Set(['fold', 'shape']);

/**
 * The example recipe, worked out by the same engine as the calculator, for
 * the next dinner it can make. Nothing on this page is a mock-up.
 */
function useExample() {
  return useMemo(() => {
    const style = getStyleById(EXAMPLE_STYLE_ID);
    if (!style) return null;
    const params = paramsForStyle(style);
    try {
      const results = calculateWithPlan(paramsToInputs(style, params), DEFAULT_PLAN, new Date());
      return { style, results, link: `/calculator?${paramsToQuery(params)}` };
    } catch (error) {
      console.error('Example recipe failed', error);
      return null;
    }
  }, []);
}

const gramsOf = (results: CalculationResults, section: string, type: string) =>
  results.sections
    .find((s) => s.id === section)
    ?.ingredients.filter((i) => i.type === type)
    .reduce((sum, i) => sum + i.grams, 0) ?? 0;

export default function Landing() {
  const { t, lang } = useI18n();
  const example = useExample();
  const styleCount = BREAD_STYLES.length;

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* ── Hero: the promise on the left, the loaf on the right ── */}
      <section className="relative isolate flex min-h-[88dvh] flex-col overflow-hidden text-white">
        <img
          src={heroBakery}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[65%_center]"
        />
        {/* A scrim, not decoration: it buys the text its contrast. On a phone
            the copy covers the whole photo; wider, it darkens only the left. */}
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-black/65 via-black/60 to-black/75 md:bg-gradient-to-r md:from-black/80 md:via-black/50 md:to-black/10"
          aria-hidden
        />

        <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2 text-body font-semibold tracking-tight">
            <ChefHat className="h-5 w-5 text-primary-glow" aria-hidden />
            {t('app.name')}
          </span>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 pb-16 pt-6 sm:px-6 md:pb-24">
          <div className="max-w-xl animate-fade-up">
            <h1 className="text-display-lg sm:text-display-xl">{t('hero.title')}</h1>
            <p className="mt-5 max-w-lg text-lead text-white/85">
              {t('hero.lead', { n: styleCount })}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="xl" className="w-full sm:w-auto">
                <Link to="/calculator">
                  {t('hero.cta')}
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                size="xl"
                variant="outline"
                className="w-full border-white/40 bg-white/10 text-white hover:border-white hover:bg-white/20 hover:text-white sm:w-auto"
              >
                <a href="#plan">{t('hero.secondary')}</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {example && <PlanSection example={example} />}
      {example && <NumbersSection example={example} />}

      {/* ── Everything else, as a list rather than a wall of equal tiles ── */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-display-md sm:text-display-lg">{t('landing.more.title')}</h2>
          <dl className="mt-10 divide-y divide-border border-y border-border">
            {(['styles', 'share', 'mcp'] as const).map((key) => (
              <div
                key={key}
                className="grid grid-cols-1 gap-2 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-10"
              >
                <dt className="text-display-sm">{t(`landing.more.${key}.title`, { n: styleCount })}</dt>
                <dd className="max-w-[60ch] text-muted-foreground">{t(`landing.more.${key}.body`)}</dd>
              </div>
            ))}
          </dl>
          <Button asChild size="lg" className="mt-12">
            <Link to="/calculator">
              {t('hero.cta')}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

interface Example {
  style: BreadStyle;
  results: CalculationResults;
  link: string;
}

/** "Ready when you want to eat", shown with the plan itself. */
function PlanSection({ example }: { example: Example }) {
  const { t, lang } = useI18n();
  const { style, results, link } = example;
  const steps: TimelineStep[] = results.timeline.filter(
    (step) => (step.handsOn && !PREVIEW_SKIP.has(step.phase)) || step.phase === 'done',
  );

  return (
    <section id="plan" className="scroll-mt-4 py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 sm:px-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-16">
        <div>
          <h2 className="text-display-md sm:text-display-lg">{t('landing.plan.title')}</h2>
          <p className="mt-4 max-w-[52ch] text-body-lg text-muted-foreground">
            {t('landing.plan.body')}
          </p>
          <Button asChild variant="outline" className="mt-8">
            <Link to={link}>
              {t('landing.plan.open')}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>

        <figure className="surface p-5 sm:p-6">
          <figcaption className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="font-semibold">{style.name}</span>
            <span className="text-caption tabular text-muted-foreground">
              {t('recipe.readyAt', { time: formatDateTime(results.readyAt, lang) })}
            </span>
          </figcaption>
          <RecipeTimeline steps={steps} compact />
        </figure>
      </div>
    </section>
  );
}

/** The two numbers a baker usually guesses: how much yeast, how warm the water. */
function NumbersSection({ example }: { example: Example }) {
  const { t, lang } = useI18n();
  const { style, results } = example;
  const g = (grams: number) => formatGrams(grams, lang);
  const prefermentYeast = gramsOf(results, 'preferment', 'yeast');
  const doughYeast = gramsOf(results, 'final', 'yeast');
  const pieces = results.totals.pieces;
  const unit = t(pieceUnitKey(style, pieces));
  const form = t(`field.yeast.${results.fermentation.yeastForm}`);

  return (
    <section className="border-y border-hairline bg-card-muted py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-2xl text-display-md sm:text-display-lg">{t('landing.numbers.title')}</h2>
        <dl className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
          <div className="border-t border-border pt-6">
            <dt className="text-body-sm text-muted-foreground">
              {t('landing.yeast.label', { form, count: pieces, unit })}
            </dt>
            <dd className="mt-2 text-[clamp(3rem,8vw,4.5rem)] font-semibold leading-none tracking-tight tabular">
              {g(prefermentYeast + doughYeast)} g
            </dd>
            <dd className="mt-5 max-w-[46ch] text-muted-foreground">
              {t('landing.yeast.body', { preferment: g(prefermentYeast), dough: g(doughYeast) })}
            </dd>
          </div>
          <div className="border-t border-border pt-6">
            <dt className="text-body-sm text-muted-foreground">{t('recipe.waterTemp')}</dt>
            <dd className="mt-2 text-[clamp(3rem,8vw,4.5rem)] font-semibold leading-none tracking-tight tabular">
              {formatNumber(results.water.tempC, lang, 0)} °C
            </dd>
            <dd className="mt-5 max-w-[46ch] text-muted-foreground">
              {t('landing.water.body', {
                dough: formatNumber(results.water.doughTempC, lang, 0),
                room: formatNumber(results.fermentation.roomTempC, lang, 0),
              })}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
