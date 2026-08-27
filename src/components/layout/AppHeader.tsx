import { ChefHat, Languages, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/i18n';
import type { Language } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'sv', label: 'Svenska' },
  { code: 'en', label: 'English' },
];

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('lang.label')}>
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((option) => (
          <DropdownMenuItem
            key={option.code}
            onSelect={() => setLang(option.code)}
            className={lang === option.code ? 'font-semibold text-primary' : ''}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

interface AppHeaderProps {
  showSidebarTrigger?: boolean;
  /** Shown in place of the wordmark when the sidebar already carries it. */
  context?: string;
}

export function AppHeader({ showSidebarTrigger = true, context }: AppHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="no-print sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          {showSidebarTrigger && <SidebarTrigger className="shrink-0" />}
          {showSidebarTrigger ? (
            <p className="truncate text-sm font-medium text-muted-foreground">
              {context ?? t('app.tagline')}
            </p>
          ) : (
            <Link
              to="/"
              className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 transition-colors hover:text-primary"
            >
              <ChefHat className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span className="truncate text-sm font-semibold tracking-tight sm:text-base">
                {t('app.name')}
              </span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link to="/">{t('nav.home')}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
