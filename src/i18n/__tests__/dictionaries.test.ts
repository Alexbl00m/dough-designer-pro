import { describe, expect, it } from 'vitest';
import { BREAD_STYLES } from '@/data/styles';
import { DICTIONARIES, createTranslator, interpolate } from '@/i18n/translate';
import { calculateRecipe } from '@/core/calculations';

const { sv, en } = DICTIONARIES;
const START = new Date('2026-03-14T09:00:00Z');

const buildAll = (leavenType: 'commercial' | 'sourdough' | 'hybrid') =>
  BREAD_STYLES.map((style) =>
    calculateRecipe({
      style,
      ballWeight: style.defaults.ballWeight,
      ballCount: style.defaults.ballCount,
      totalTime: style.defaults.totalTime,
      roomTemp: style.defaults.roomTemp,
      coldHours: style.defaults.coldHours,
      leavenType,
      yeastForm: 'instant',
      mixing: 'hand',
      desiredDoughTemp: style.defaults.doughTemp,
      startTime: START,
    }),
  );

describe('dictionaries', () => {
  it('define the same keys in both languages', () => {
    const svKeys = new Set(Object.keys(sv));
    const enKeys = new Set(Object.keys(en));
    expect([...svKeys].filter((k) => !enKeys.has(k)), 'missing in en').toEqual([]);
    expect([...enKeys].filter((k) => !svKeys.has(k)), 'missing in sv').toEqual([]);
  });

  it('use the same placeholders in both languages', () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(sv)) {
      expect(placeholders(sv[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('has copy for every style, in both languages', () => {
    for (const lang of ['sv', 'en'] as const) {
      const dict = DICTIONARIES[lang];
      for (const style of BREAD_STYLES) {
        expect(dict[`style.${style.id}.desc`], `${lang}/${style.id}.desc`).toBeTruthy();
        for (let i = 0; i < style.characteristicCount; i += 1) {
          expect(dict[`style.${style.id}.char.${i}`], `${lang}/${style.id}.char.${i}`).toBeTruthy();
        }
        expect(dict[style.regionKey], `${lang}/${style.regionKey}`).toBeTruthy();
        for (const key of [
          ...(style.flourBlend ?? []).map((f) => f.key),
          ...(style.liquids ?? []).map((l) => l.key),
          ...(style.extras ?? []).map((e) => e.key),
          style.defaultParams.fatKey,
          style.defaultParams.sugarKey,
        ].filter(Boolean)) {
          expect(dict[key as string], `${lang}/${key}`).toBeTruthy();
        }
      }
    }
  });
});

describe('engine output is fully translatable', () => {
  it('resolves every key the engine emits, in both languages', () => {
    const missing: string[] = [];
    for (const lang of ['sv', 'en'] as const) {
      const dict = DICTIONARIES[lang];
      for (const leaven of ['commercial', 'sourdough', 'hybrid'] as const) {
        for (const r of buildAll(leaven)) {
          const keys = [
            ...r.sections.flatMap((s) => [
              s.titleKey,
              ...s.ingredients.flatMap((i) => [i.key, ...(i.note ? [i.note] : [])]),
            ]),
            ...r.timeline.flatMap((s) => [
              s.key,
              `${s.key}.body`,
              ...(s.values?.technique ? [String(s.values.technique)] : []),
            ]),
            ...r.notes.map((n) => n.code),
          ];
          for (const key of keys) {
            if (!(key in dict)) missing.push(`${lang}/${leaven}: ${key}`);
          }
        }
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  it('leaves no unfilled placeholder in any rendered note or step', () => {
    for (const lang of ['sv', 'en'] as const) {
      const t = createTranslator(lang);
      for (const leaven of ['commercial', 'sourdough'] as const) {
        for (const r of buildAll(leaven)) {
          for (const note of r.notes) {
            expect(t(note.code, note.values), `${lang}/${note.code}`).not.toMatch(/\{\w+\}/);
          }
          for (const step of r.timeline) {
            const values = step.values?.technique
              ? { ...step.values, technique: t(String(step.values.technique)) }
              : step.values;
            expect(t(`${step.key}.body`, values), `${lang}/${step.key}`).not.toMatch(/\{\w+\}/);
          }
        }
      }
    }
  });
});

describe('interpolate', () => {
  it('fills known placeholders and leaves unknown ones visible', () => {
    expect(interpolate('{a} and {b}', { a: 1 })).toBe('1 and {b}');
  });

  it('returns the template untouched when there is nothing to fill', () => {
    expect(interpolate('plain text')).toBe('plain text');
  });

  it('falls back to the other language rather than showing a raw key', () => {
    const t = createTranslator('sv');
    expect(t('app.name')).toBe("Baker's Calculator");
  });
});
