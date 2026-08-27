import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { AppHeader } from '@/components/layout/AppHeader';
import { deleteBake, listBakes, updateBake } from '@/lib/recipe/storage';
import type { SavedBake } from '@/lib/recipe/storage';
import { paramsToQuery } from '@/lib/recipe/state';
import { getStyleById } from '@/data/styles';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';

export default function Saved() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [bakes, setBakes] = useState<SavedBake[]>([]);

  useEffect(() => {
    setBakes(listBakes());
  }, []);

  const handleDelete = useCallback(
    (bake: SavedBake) => {
      if (!window.confirm(t('saved.confirmDelete', { name: bake.name }))) return;
      deleteBake(bake.id);
      setBakes(listBakes());
    },
    [t],
  );

  const handleNote = useCallback((id: string, note: string) => {
    updateBake(id, { note });
    setBakes(listBakes());
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showSidebarTrigger={false} />

      <main className="mx-auto w-full max-w-4xl p-4 sm:p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{t('saved.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('saved.lead')}</p>
        </header>

        {bakes.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">{t('saved.empty')}</p>
            <Button asChild className="mt-4">
              <Link to="/calculator">{t('hero.cta')}</Link>
            </Button>
          </Card>
        ) : (
          <ul className="space-y-3">
            {bakes.map((bake) => {
              const style = getStyleById(bake.params.styleId);
              return (
                <li key={bake.id}>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-semibold">{bake.name}</h2>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {style ? t(style.regionKey) : bake.params.styleId} ·{' '}
                          {t('saved.date')} {formatDate(bake.savedAt, lang)}
                        </p>
                        <p className="mt-1 text-sm tabular text-muted-foreground">
                          {bake.params.ballCount} × {bake.params.ballWeight} g ·{' '}
                          {bake.params.hydration}% · {bake.params.totalTime} h
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          onClick={() => navigate(`/calculator?${paramsToQuery(bake.params)}`)}
                          className="gap-1.5"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          {t('action.load')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(bake)}
                          aria-label={t('action.delete')}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label
                        htmlFor={`note-${bake.id}`}
                        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        {t('saved.note')}
                      </label>
                      <Textarea
                        id={`note-${bake.id}`}
                        defaultValue={bake.note ?? ''}
                        placeholder={t('saved.notePlaceholder')}
                        rows={2}
                        className="mt-1.5 resize-y"
                        onBlur={(event) => handleNote(bake.id, event.target.value)}
                      />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
