/**
 * Flour strength, pinned to the sources:
 *  - The Italian maturation table: W 260 ≈ 9 h, W 280 ≈ 12 h, W 320 ≈ 24 h,
 *    W 380 ≈ 48 h, W 400 ≈ 72 h (Maccaturo, GialloZafferano).
 *  - A blend's W is the weighted average: 70% W 260 + 30% W 380 = W 296.
 *  - Caputo rates Pizzeria (W 260–270) for doughs of up to 24 h.
 */

import { describe, expect, it } from 'vitest';
import { getStyleById } from '@/data/styles';
import { calculateRecipe } from '@/core/calculations';
import {
  adviseFlour,
  blendMaturationHours,
  normalizeBlend,
  optimumHours,
  recommendedW,
} from '@/core/flour';
import { FLOURS, getFlour } from '@/data/flours';

describe('the maturation table', () => {
  it('recommends the published strength for each maturation time', () => {
    expect(recommendedW(9)).toBeCloseTo(260, 6);
    expect(recommendedW(12)).toBeCloseTo(280, 6);
    expect(recommendedW(24)).toBeCloseTo(320, 6);
    expect(recommendedW(48)).toBeCloseTo(380, 6);
  });

  it('asks for more strength the longer the dough matures, and the inverse agrees', () => {
    let previous = 0;
    for (const hours of [2, 4, 8, 12, 18, 24, 36, 48, 72]) {
      const w = recommendedW(hours);
      expect(w, `${hours} h`).toBeGreaterThan(previous);
      expect(optimumHours(w)).toBeCloseTo(hours, 6);
      previous = w;
    }
  });
});

describe('a blend', () => {
  it('averages W by weight, the way millers cut flour', () => {
    const advice = adviseFlour({
      parts: [
        { id: 'caputo_pizzeria', pct: 70 },
        { id: 'caputo_manitoba', pct: 30 },
      ],
      maturationHours: 24,
      pizza: true,
    });
    // 0.7 × 265 + 0.3 × 380 — the midpoints of the published ranges.
    expect(advice.w).toBe(300);
    expect(advice.wEstimated).toBe(false);
    expect(advice.proteinPct).toBeCloseTo(13.1, 1);
  });

  it('leaves semolina, wholegrain and rye out of W, and says how much', () => {
    const advice = adviseFlour({
      parts: [
        { id: 'caputo_pizzeria', pct: 60 },
        { id: 'semolina', pct: 40 },
      ],
      maturationHours: 8,
      pizza: true,
    });
    expect(advice.w).toBe(265);
    expect(advice.specialtyPct).toBe(40);
  });

  it('scales shares to 100 and drops flours it does not know', () => {
    expect(
      normalizeBlend([
        { id: 'caputo_pizzeria', pct: 3 },
        { id: 'not_a_flour', pct: 50 },
        { id: 'caputo_manitoba', pct: 1 },
      ]),
    ).toEqual([
      { id: 'caputo_pizzeria', pct: 75 },
      { id: 'caputo_manitoba', pct: 25 },
    ]);
    expect(normalizeBlend([])).toBeUndefined();
  });
});

describe('the verdict', () => {
  const pizzeria = (maturationHours: number) =>
    adviseFlour({ parts: [{ id: 'caputo_pizzeria', pct: 100 }], maturationHours, pizza: true });

  it('accepts Caputo Pizzeria up to the 24 h Caputo rates it for', () => {
    expect(pizzeria(8).fit).toBe('ok');
    expect(pizzeria(24).fit).not.toBe('weak');
  });

  it('calls it too weak for a 48 h dough', () => {
    expect(pizzeria(48).fit).toBe('weak');
  });

  it('says when a flour is far stronger than a short dough needs', () => {
    const advice = adviseFlour({
      parts: [{ id: 'caputo_manitoba', pct: 100 }],
      maturationHours: 3,
      pizza: true,
    });
    expect(advice.fit).toBe('strong');
  });

  it('flags a blend below the style’s own minimum protein', () => {
    const advice = adviseFlour({
      parts: [{ id: 'ap', pct: 100 }],
      maturationHours: 6,
      pizza: true,
      minProteinPct: 12,
    });
    expect(advice.fit).toBe('weak');
    expect(advice.minProteinPct).toBe(12);
  });
});

describe('suggestions', () => {
  it('names a pizza flour made for a 24 h dough', () => {
    const advice = adviseFlour({
      parts: [{ id: 'caputo_pizzeria', pct: 100 }],
      maturationHours: 24,
      pizza: true,
    });
    const named = advice.suggestions.map((s) => s.parts.map((p) => p.id).join('+'));
    expect(named.some((n) => n === 'caputo_saccorosso' || n === 'le5stagioni_napoletana')).toBe(true);
  });

  it('can keep the baker’s own flour and cut it with Manitoba, never more than 30% for pizza', () => {
    const advice = adviseFlour({
      parts: [{ id: 'caputo_pizzeria', pct: 100 }],
      maturationHours: 24,
      pizza: true,
    });
    const cut = advice.suggestions.find((s) => s.parts.some((p) => p.id === 'caputo_manitoba'))!;
    expect(cut.parts.find((p) => p.id === 'caputo_pizzeria')).toBeTruthy();
    expect(cut.parts.find((p) => p.id === 'caputo_manitoba')!.pct).toBeLessThanOrEqual(30);
  });

  it('starts from a stronger base when the baker’s flour cannot get there, and never repeats their blend', () => {
    const current = [
      { id: 'caputo_pizzeria', pct: 70 },
      { id: 'caputo_manitoba', pct: 30 },
    ];
    const advice = adviseFlour({ parts: current, maturationHours: 48, pizza: true });
    expect(advice.fit).toBe('weak');
    expect(advice.suggestions.length).toBeGreaterThan(0);
    for (const s of advice.suggestions) {
      expect(s.parts).not.toEqual(current);
      expect(s.w).toBeGreaterThan(advice.w!);
      expect(s.parts.find((p) => p.id === 'caputo_manitoba')?.pct ?? 0).toBeLessThanOrEqual(30);
    }
  });

  it('keeps the semolina when it suggests a different white flour', () => {
    const advice = adviseFlour({
      parts: [
        { id: 'tipo00', pct: 60 },
        { id: 'semolina', pct: 40 },
      ],
      maturationHours: 24,
      pizza: true,
    });
    for (const s of advice.suggestions) {
      expect(s.parts.find((p) => p.id === 'semolina')?.pct).toBe(40);
      expect(s.parts.reduce((sum, p) => sum + p.pct, 0)).toBe(100);
    }
  });

  it('does not push a bread baker to change a flour that suits the plan', () => {
    const advice = adviseFlour({
      parts: [{ id: 'bread', pct: 100 }],
      maturationHours: 6,
      pizza: false,
    });
    expect(advice.fit).toBe('ok');
    expect(advice.suggestions).toEqual([]);
  });

  it('only ever suggests flours that exist', () => {
    for (const hours of [4, 8, 16, 24, 48, 72]) {
      for (const pizza of [true, false]) {
        const advice = adviseFlour({ parts: [{ id: 'tipo00', pct: 100 }], maturationHours: hours, pizza });
        for (const s of advice.suggestions) for (const p of s.parts) expect(getFlour(p.id)).toBeTruthy();
      }
    }
  });
});

describe('maturation in a recipe with a preferment', () => {
  it('counts the preferment’s flour for its whole build, the rest for the dough only', () => {
    expect(blendMaturationHours(4, 14, 0.4)).toBeCloseTo(0.4 * 18 + 0.6 * 4, 10);
    expect(blendMaturationHours(6)).toBe(6);
  });
});

describe('the engine', () => {
  const style = getStyleById('pizza_poolish')!;
  const build = (flourBlend?: { id: string; pct: number }[]) =>
    calculateRecipe({
      style,
      ballWeight: 270,
      ballCount: 6,
      totalTime: 6,
      roomTemp: 22,
      leavenType: 'commercial',
      yeastForm: 'instant',
      mixing: 'hand',
      desiredDoughTemp: 24,
      flourBlend,
      now: new Date(2026, 9, 4, 9),
    });

  it('splits the final dough’s flour across the baker’s blend', () => {
    const r = build([
      { id: 'caputo_pizzeria', pct: 70 },
      { id: 'caputo_manitoba', pct: 30 },
    ]);
    const final = r.sections.find((s) => s.id === 'final')!;
    const pizzeria = final.ingredients.find((i) => i.key === 'flour.caputo_pizzeria')!;
    const manitoba = final.ingredients.find((i) => i.key === 'flour.caputo_manitoba')!;
    expect(pizzeria.grams / (pizzeria.grams + manitoba.grams)).toBeCloseTo(0.7, 2);
    expect(r.flour.w).toBe(300);
  });

  it('keeps the batch the same size whatever the flours', () => {
    const plain = build();
    const blended = build([
      { id: 'caputo_nuvola', pct: 50 },
      { id: 'caputo_saccorosso', pct: 30 },
      { id: 'caputo_manitoba', pct: 20 },
    ]);
    expect(blended.totals.flour).toBeCloseTo(plain.totals.flour, 6);
    expect(blended.totals.doughWeight).toBeCloseTo(plain.totals.doughWeight, 0);
  });

  it('falls back to the style’s flours without a blend', () => {
    const r = build();
    const final = r.sections.find((s) => s.id === 'final')!;
    expect(final.ingredients.some((i) => i.key === 'flour.tipo00')).toBe(true);
  });
});

describe('the catalogue', () => {
  it('has unique ids and sensible numbers', () => {
    expect(new Set(FLOURS.map((f) => f.id)).size).toBe(FLOURS.length);
    for (const f of FLOURS) {
      expect(f.proteinPct, f.id).toBeGreaterThan(5);
      expect(f.proteinPct, f.id).toBeLessThan(18);
      if (f.w) expect(f.w[0], f.id).toBeLessThanOrEqual(f.w[1]);
    }
  });
});
