import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';

export default function NotFound() {
  const location = useLocation();
  const t = useT();

  useEffect(() => {
    console.warn('404: no route for', location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="text-center">
        <p className="text-6xl font-bold text-primary">404</p>
        <h1 className="mt-4 text-2xl font-semibold">{t('notFound.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('notFound.body')}</p>
        <Button asChild className="mt-6">
          <Link to="/">{t('notFound.cta')}</Link>
        </Button>
      </div>
    </div>
  );
}
