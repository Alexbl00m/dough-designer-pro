import { ArrowRight, Calculator, ChefHat, Clock, FileDown, Plug, Thermometer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LanguageToggle, ThemeToggle } from '@/components/layout/AppHeader';
import { BREAD_STYLES } from '@/data/styles';
import { useT } from '@/i18n';
import heroBakery from '@/assets/hero-bakery.jpg';

const FEATURES = [
  { key: 'q10', icon: Calculator },
  { key: 'timing', icon: Clock },
  { key: 'ddt', icon: Thermometer },
  { key: 'styles', icon: ChefHat },
  { key: 'export', icon: FileDown },
  { key: 'mcp', icon: Plug },
] as const;

export default function Landing() {
  const t = useT();
  const styleCount = BREAD_STYLES.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1 text-white">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <section className="relative flex min-h-[88vh] items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBakery})` }}
          role="presentation"
        />
        {/* A gradient rather than a flat scrim: the image stays visible up top
            while the text below keeps its contrast ratio. */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/80"
          aria-hidden
        />

        <div className="relative z-10 mx-auto max-w-3xl animate-fade-up px-5 text-center text-white">
          <ChefHat className="mx-auto mb-5 h-12 w-12 text-primary-glow" aria-hidden />

          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            {t('hero.title')}{' '}
            <span className="bg-gradient-to-r from-primary-glow to-primary bg-clip-text text-transparent">
              {t('hero.titleAccent')}
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl whitespace-pre-line text-base leading-relaxed text-white/85 sm:text-lg">
            {t('hero.lead')}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="xl" variant="premium" className="w-full sm:w-auto">
              <Link to="/calculator">
                <Calculator className="h-5 w-5" aria-hidden />
                {t('hero.cta')}
              </Link>
            </Button>
            <Button
              asChild
              size="xl"
              variant="outline"
              className="w-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:w-auto"
            >
              <a href="#features">
                {t('hero.secondary')}
                <ArrowRight className="h-5 w-5" aria-hidden />
              </a>
            </Button>
          </div>

          <p className="mt-6 text-sm text-white/60">{t('hero.styles', { n: styleCount })}</p>
        </div>
      </section>

      <section id="features" className="scroll-mt-8 bg-muted/40 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('feature.title')}</h2>
            <p className="mt-3 text-lg text-muted-foreground">{t('feature.lead')}</p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ key, icon: Icon }) => (
              <div key={key} className="group">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  {t(`feature.${key}.title`, { n: styleCount })}
                </h3>
                <p className="leading-relaxed text-muted-foreground">
                  {t(`feature.${key}.body`)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <Button asChild size="lg">
              <Link to="/calculator">
                {t('hero.cta')}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
