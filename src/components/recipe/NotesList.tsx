import { AlertTriangle, Info, Lightbulb } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { Note, NoteSeverity } from '@/core/types';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

const ICON: Record<NoteSeverity, typeof Info> = {
  warn: AlertTriangle,
  tip: Lightbulb,
  info: Info,
};

const TONE: Record<NoteSeverity, string> = {
  warn: 'text-warning',
  tip: 'text-primary',
  info: 'text-muted-foreground',
};

/** Warnings first — a baker skimming on their way to the mixer sees those. */
const ORDER: Record<NoteSeverity, number> = { warn: 0, tip: 1, info: 2 };

export function NotesList({ notes }: { notes: Note[] }) {
  const t = useT();
  if (!notes.length) return null;

  const sorted = [...notes].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  return (
    <Card className="p-5" data-print-card>
      <h4 className="mb-3 font-semibold">{t('recipe.notes')}</h4>
      <ul className="space-y-2.5">
        {sorted.map((note, index) => {
          const Icon = ICON[note.severity];
          return (
            <li key={`${note.code}-${index}`} className="flex gap-2.5 text-sm">
              <Icon
                className={cn('mt-0.5 h-4 w-4 shrink-0', TONE[note.severity])}
                aria-hidden
              />
              <span className="leading-relaxed text-muted-foreground">
                {t(note.code, note.values)}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
