/**
 * Plain-text export.
 *
 * A bake sheet you can paste into notes, print, or read on a floury phone.
 * Deliberately text, not PDF: it survives copy-paste anywhere and needs no
 * dependency. Printing the page produces the formatted version.
 */

import type { BreadStyle } from '@/data/styles';
import type { CalculationResults } from '@/core/types';
import type { Translator } from '@/i18n';
import type { Language } from '@/i18n';
import {
  formatClock,
  formatDateTime,
  formatDayHeading,
  formatDuration,
  formatGrams,
  formatNumber,
  formatPercent,
  formatSectionMeta,
  localDayKey,
  resolveStepValues,
} from '@/lib/format';

export function recipeToText(
  style: BreadStyle,
  results: CalculationResults,
  t: Translator,
  lang: Language,
  shareUrl?: string,
): string {
  const lines: string[] = [];
  const rule = '─'.repeat(46);

  lines.push(style.name.toUpperCase());
  lines.push(t(style.regionKey));
  lines.push(rule);
  lines.push(
    `${results.totals.pieces} × ${formatGrams(results.totals.perPiece, lang)} g · ${formatGrams(results.totals.doughWeight, lang)} g ${t('recipe.totalDough').toLowerCase()}`,
  );
  lines.push(
    `${t('recipe.totalFlour')}: ${formatGrams(results.totals.flour, lang)} g · ${t('field.hydration')}: ${formatNumber(results.params.hydration, lang)}%`,
  );
  // The plan first: a bake sheet is read standing at the bench, and "when" is
  // the first question.
  lines.push(
    `${t('plan.startsAt')}: ${formatDateTime(results.plan.startsAt, lang)} · ${t('plan.readyAt')}: ${formatDateTime(results.readyAt, lang)}`,
  );
  if (results.preferment) {
    lines.push(
      t('plan.fermentSplit', {
        type: t(`section.${results.preferment.type}`),
        pref: formatNumber(results.preferment.hours, lang),
        dough: formatNumber(results.fermentation.totalHours, lang),
        total: formatNumber(results.plan.fermentHours, lang),
      }),
    );
  }
  lines.push('');

  for (const section of results.sections) {
    const meta = section.meta ? ` (${formatSectionMeta(section.meta, t)})` : '';
    lines.push(`${t(section.titleKey).toUpperCase()}${meta}`);
    for (const ing of section.ingredients) {
      const name = t(ing.key).padEnd(28, '.');
      const grams = `${formatGrams(ing.grams, lang)} g`.padStart(10);
      lines.push(`  ${name}${grams}   ${formatPercent(ing.percentage, lang)}%`);
    }
    lines.push(`  ${t('recipe.sectionTotal', { grams: formatGrams(section.totalGrams, lang) })}`);
    lines.push('');
  }

  lines.push(t('recipe.process').toUpperCase());
  lines.push(`  ${t('recipe.waterTemp')}: ${formatNumber(results.water.tempC, lang)} °C`);
  lines.push(`  ${t('recipe.bulk')}: ${formatNumber(results.fermentation.bulkHours, lang)} h`);
  lines.push(`  ${t('recipe.proof')}: ${formatNumber(results.fermentation.proofHours, lang)} h`);
  if (results.fermentation.coldHours > 0) {
    lines.push(
      `  ${t('recipe.coldRetard')}: ${formatNumber(results.fermentation.coldHours, lang)} h @ ${results.fermentation.coldTempC} °C`,
    );
  }
  lines.push('');

  lines.push(t('recipe.timeline').toUpperCase());
  let lastDay: string | null = null;
  for (const step of results.timeline) {
    const day = localDayKey(step.at);
    if (day !== lastDay) {
      lines.push(`  ${formatDayHeading(step.at, lang)}`);
      lastDay = day;
    }
    const clock = formatClock(step.at, lang);
    const duration = step.durationMin > 0 ? ` (${formatDuration(step.durationMin, t)})` : '';
    lines.push(`    ${clock}  ${t(step.key, resolveStepValues(step.values, t))}${duration}`);
  }
  lines.push('');

  if (results.notes.length) {
    lines.push(t('recipe.notes').toUpperCase());
    for (const note of results.notes) {
      lines.push(`  • ${t(note.code, note.values)}`);
    }
    lines.push('');
  }

  lines.push(rule);
  lines.push(t('recipe.printedBy'));
  if (shareUrl) lines.push(shareUrl);

  return lines.join('\n');
}

/** Copy to the clipboard, falling back to a hidden textarea on older browsers. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or insecure context — try the legacy path.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Filesystem-safe filename from a style name and date. */
export function recipeFilename(styleName: string): string {
  const slug = styleName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'recipe'}-${new Date().toISOString().slice(0, 10)}.txt`;
}
