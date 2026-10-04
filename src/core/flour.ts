/**
 * Flour strength: what a blend can stand, what the plan asks of it, and which
 * flour would fit.
 *
 * Strength is the Chopin W printed on Italian flour bags. A blend's W is the
 * flour-weighted average of its parts — the rule millers and pizzaioli use to
 * "cut" one flour with another (Silvio Cicchi, Massimo De Santis). How long a
 * flour can mature follows the Italian maturation table — W 260 about 9 h,
 * W 280 about 12 h, W 320 about 24 h, W 380 about 48 h (Maccaturo,
 * GialloZafferano) — counted in hours on the clock, fridge included, because
 * maturation is enzymatic and goes on in the cold.
 *
 * That table gives a flour's optimum, not its limit: Caputo rates Pizzeria
 * (W 260–270, about 10 h on the table) for doughs of up to 24 h. So a flour is
 * only called too weak past two and a half times its optimum.
 */

import { FLOURS, getFlour, flourIdOfKey } from '@/data/flours';
import type { FlourSpec } from '@/data/flours';
import { clamp, round } from './constants';

export interface BlendPart {
  /** Catalogue id, e.g. `caputo_pizzeria`. */
  id: string;
  /** Share of the flour, %. */
  pct: number;
}

/** [hours, W]: the maturation each strength is made for. */
export const MATURATION_TABLE: readonly [number, number][] = [
  [2, 160],
  [3, 180],
  [3.5, 200],
  [4, 215],
  [6, 240],
  [9, 260],
  [12, 280],
  [15, 300],
  [24, 320],
  [48, 380],
  [72, 400],
];

/** A flour is only too weak past this multiple of its optimum maturation. */
export const MATURATION_TOLERANCE = 2.5;

/**
 * W for a white wheat flour with no published figure, from its protein. Rough:
 * it lands within about 10% of the published W for the flours that print both.
 */
export const estimateW = (proteinPct: number): number =>
  clamp(250 + (proteinPct - 12) * 40, 120, 420);

/** The W the table recommends for this many hours of maturation. */
export function recommendedW(hours: number): number {
  const table = MATURATION_TABLE;
  const h = clamp(hours, table[0][0], table[table.length - 1][0]);
  for (let i = 0; i < table.length - 1; i += 1) {
    const [h0, w0] = table[i];
    const [h1, w1] = table[i + 1];
    if (h <= h1) {
      const f = (Math.log(h) - Math.log(h0)) / (Math.log(h1) - Math.log(h0));
      return w0 + f * (w1 - w0);
    }
  }
  return table[table.length - 1][1];
}

/** The maturation, in hours, a flour of this W is made for. */
export function optimumHours(w: number): number {
  const table = MATURATION_TABLE;
  if (w <= table[0][1]) return table[0][0];
  for (let i = 0; i < table.length - 1; i += 1) {
    const [h0, w0] = table[i];
    const [h1, w1] = table[i + 1];
    if (w <= w1) {
      const f = (w - w0) / (w1 - w0);
      return Math.exp(Math.log(h0) + f * (Math.log(h1) - Math.log(h0)));
    }
  }
  return table[table.length - 1][0];
}

export interface FlourPart extends BlendPart {
  proteinPct: number;
  /** Published or estimated W; unset for flours that do not build white-flour gluten. */
  w?: number;
  wEstimated: boolean;
}

/** One flour's strength: the published W's midpoint, or an estimate from protein. */
function strengthOf(spec: FlourSpec | undefined, proteinPct: number) {
  if (spec?.use === 'specialty') return { w: undefined, wEstimated: false };
  if (spec?.w) return { w: (spec.w[0] + spec.w[1]) / 2, wEstimated: false };
  return { w: estimateW(proteinPct), wEstimated: true };
}

/**
 * A blend with shares that add up to 100, unknown flours and empty shares
 * dropped. Returns undefined when nothing usable is left.
 */
export function normalizeBlend(parts: BlendPart[] | undefined): BlendPart[] | undefined {
  const usable = (parts ?? []).filter((p) => getFlour(p.id) && p.pct > 0).slice(0, 3);
  const sum = usable.reduce((s, p) => s + p.pct, 0);
  if (!usable.length || sum <= 0) return undefined;
  return usable.map((p) => ({ id: p.id, pct: (p.pct / sum) * 100 }));
}

/** Describe a blend part by part, with protein and strength. */
export function describeBlend(
  parts: { id: string; pct: number; proteinPct?: number }[],
): FlourPart[] {
  return parts.map((p) => {
    const spec = getFlour(p.id);
    const proteinPct = p.proteinPct ?? spec?.proteinPct ?? 12;
    return { id: p.id, pct: p.pct, proteinPct, ...strengthOf(spec, proteinPct) };
  });
}

/** A style blend, which names flours by i18n key, as catalogue parts. */
export const partsOfStyleBlend = (
  blend: { key: string; percentage: number; protein_pct?: number }[] | undefined,
) =>
  (blend ?? []).map((f) => ({
    id: flourIdOfKey(f.key),
    pct: f.percentage,
    proteinPct: f.protein_pct,
  }));

export type FlourFit = 'ok' | 'edge' | 'weak' | 'strong' | 'unknown';

export interface FlourSuggestion {
  parts: BlendPart[];
  w: number;
}

export interface FlourAdvice {
  parts: FlourPart[];
  proteinPct: number;
  /** The blend's W, averaged over the flours that have one. */
  w?: number;
  /** Some of that W is estimated from protein rather than published. */
  wEstimated: boolean;
  /** Semolina, wholegrain, rye or spelt in the blend, %: not counted in W. */
  specialtyPct: number;
  /**
   * Hours the flour matures, fridge included, averaged over the blend: the
   * preferment's share counts its whole build plus the dough's time.
   */
  maturationHours: number;
  /** The W the maturation table recommends for that. */
  recommendedW: number;
  /** The maturation the blend's W is made for. */
  optimumHours?: number;
  fit: FlourFit;
  /** The style's own minimum protein, when the blend falls short of it. */
  minProteinPct?: number;
  suggestions: FlourSuggestion[];
}

export interface FlourAdviceInput {
  parts: { id: string; pct: number; proteinPct?: number }[];
  maturationHours: number;
  pizza: boolean;
  minProteinPct?: number;
}

export function adviseFlour(input: FlourAdviceInput): FlourAdvice {
  const parts = describeBlend(input.parts);
  const total = parts.reduce((s, p) => s + p.pct, 0) || 1;
  const proteinPct = parts.reduce((s, p) => s + p.proteinPct * p.pct, 0) / total;

  const rated = parts.filter((p) => p.w !== undefined);
  const ratedPct = rated.reduce((s, p) => s + p.pct, 0);
  const w = ratedPct > 0 ? rated.reduce((s, p) => s + (p.w as number) * p.pct, 0) / ratedPct : undefined;
  const wEstimated = rated.some((p) => p.wEstimated);
  const specialtyPct = (total - ratedPct) / total * 100;

  const hours = Math.max(1, input.maturationHours);
  const target = recommendedW(hours);
  const optimum = w !== undefined ? optimumHours(w) : undefined;
  const belowStyle =
    input.minProteinPct !== undefined && proteinPct < input.minProteinPct - 0.25;

  let fit: FlourFit = 'unknown';
  if (optimum !== undefined) {
    if (hours > optimum * MATURATION_TOLERANCE || belowStyle) fit = 'weak';
    else if (hours > optimum * 1.6) fit = 'edge';
    else if (hours < optimum / 3) fit = 'strong';
    else fit = 'ok';
  } else if (belowStyle) {
    fit = 'weak';
  }

  return {
    parts,
    proteinPct: round(proteinPct, 1),
    w: w !== undefined ? round(w, 0) : undefined,
    wEstimated,
    specialtyPct: round(specialtyPct, 1),
    maturationHours: round(hours, 1),
    recommendedW: round(target, 0),
    optimumHours: optimum !== undefined ? round(optimum, 1) : undefined,
    fit,
    minProteinPct: belowStyle ? input.minProteinPct : undefined,
    // A pizza baker always gets the flour that suits the plan; a bread baker
    // only when the flour is short of what the plan asks.
    suggestions:
      input.pizza || fit === 'weak' || fit === 'edge'
        ? suggestFlours(parts, target, input.pizza, fit === 'weak' || fit === 'edge')
        : [],
  };
}

/**
 * The maturation the flour sees, averaged over the blend: a preferment's
 * share matures for its whole build and then with the dough; the rest only
 * with the dough. A baguette's 14 h poolish does not ask its final-dough
 * flour to stand 18 hours.
 */
export function blendMaturationHours(
  doughHours: number,
  prefermentHours = 0,
  prefermentShare = 0,
): number {
  const share = clamp(prefermentShare, 0, 1);
  return share * (prefermentHours + doughHours) + (1 - share) * doughHours;
}

/**
 * What a suggestion may be made of. Pizza gets the pizza flours whose W the
 * mill publishes; bread gets everyday and strong flours.
 */
const candidates = (pizza: boolean) =>
  FLOURS.filter((f) =>
    pizza ? f.use === 'pizza' && f.w !== undefined : f.use === 'bread' || f.use === 'strong',
  );

const midW = (f: FlourSpec) => (f.w ? (f.w[0] + f.w[1]) / 2 : estimateW(f.proteinPct));

/**
 * Up to two ways to get closer to the recommended W: the single flour nearest
 * to it, and a cut with Manitoba (or a softer flour) — of the baker's own main
 * flour when that helps, so they can keep the bag they have, or of the
 * strongest base flour when it does not. Never the blend they already have.
 */
export function suggestFlours(
  current: FlourPart[],
  targetW: number,
  pizza: boolean,
  /** Whether the baker's own blend falls short; only then is changing it worth suggesting. */
  shortOfTarget = true,
): FlourSuggestion[] {
  const pool = candidates(pizza);
  const strongest = getFlour('caputo_manitoba') as FlourSpec;
  const weakest = getFlour(pizza ? 'caputo_pizzeria' : 'ap') as FlourSpec;

  // Semolina, wholegrain and rye are there for the style, not for strength:
  // a suggestion swaps the white flour and keeps them.
  const kept = current.filter((p) => p.w === undefined);
  const keptPct = kept.reduce((sum, p) => sum + p.pct, 0);
  const whiteShare = Math.max(0, 100 - keptPct) / 100;
  const withKept = (parts: BlendPart[]): BlendPart[] => {
    const white = parts.map((p) => ({ id: p.id, pct: Math.round(p.pct * whiteShare) }));
    const rest = kept.map((p) => ({ id: p.id, pct: Math.round(p.pct) }));
    // Whole percentages that still add up to 100.
    const drift = 100 - [...white, ...rest].reduce((sum, p) => sum + p.pct, 0);
    if (white.length) white[0].pct += drift;
    return [...white, ...rest];
  };

  const rated = current.filter((p) => p.w !== undefined);
  const ratedPct = rated.reduce((sum, p) => sum + p.pct, 0);
  const currentW =
    ratedPct > 0 ? rated.reduce((sum, p) => sum + (p.w as number) * p.pct, 0) / ratedPct : undefined;
  const gap = (w: number) => Math.abs(w - targetW);
  const improves = (w: number) => currentW === undefined || gap(w) < gap(currentW) - 5;
  const signature = (parts: { id: string; pct: number }[]) =>
    parts
      .map((p) => `${p.id}:${Math.round(p.pct)}`)
      .sort()
      .join('|');
  const currentSignature = signature(current);

  const single = pool
    .map((f) => ({ parts: withKept([{ id: f.id, pct: 100 }]), w: round(midW(f), 0) }))
    .reduce((a, b) => (gap(b.w) < gap(a.w) ? b : a));

  // Cut a base flour toward the target. Pizza takes at most 30% Manitoba —
  // beyond that the dough fights back when it is opened.
  const cutOf = (base: { id: string; w: number }): FlourSuggestion | undefined => {
    if (gap(base.w) <= 20) return undefined;
    const partner = targetW > base.w ? strongest : weakest;
    const partnerW = midW(partner);
    if (partner.id === base.id || Math.sign(partnerW - base.w) !== Math.sign(targetW - base.w)) {
      return undefined;
    }
    const maxShare = partner.id === strongest.id ? (pizza ? 30 : 50) : 70;
    const share = clamp(Math.round(((targetW - base.w) / (partnerW - base.w)) * 20) * 5, 10, maxShare);
    return {
      parts: withKept([
        { id: base.id, pct: 100 - share },
        { id: partner.id, pct: share },
      ]),
      w: round((base.w * (100 - share) + partnerW * share) / 100, 0),
    };
  };
  const main = [...rated].sort((a, b) => b.pct - a.pct)[0];
  const fresh = (c: FlourSuggestion | undefined) =>
    c && signature(c.parts) !== currentSignature ? c : undefined;
  const mainCut = fresh(main ? cutOf({ id: main.id, w: main.w as number }) : undefined);
  // When the baker's own flour cannot get there even at the Manitoba limit,
  // start from the strongest base flour instead.
  const strongestBase = pool
    .filter((f) => f.id !== strongest.id)
    .reduce((a, b) => (midW(b) > midW(a) ? b : a));
  const strongCut =
    targetW > midW(strongestBase)
      ? fresh(cutOf({ id: strongestBase.id, w: midW(strongestBase) }))
      : undefined;
  const cut =
    mainCut && (gap(mainCut.w) <= 25 || !strongCut || gap(mainCut.w) <= gap(strongCut.w))
      ? mainCut
      : strongCut;

  const useful = (s: FlourSuggestion | undefined): s is FlourSuggestion =>
    Boolean(s) &&
    signature(s!.parts) !== currentSignature &&
    (shortOfTarget ? improves(s!.w) : gap(s!.w) <= 25);

  // Pizza bakers asked which flour to buy, so a named flour comes first; a
  // bread baker is better served keeping the bag they have.
  const ordered = pizza ? [single, shortOfTarget ? cut : undefined] : [cut, single];
  const suggestions = ordered.filter(useful);
  return suggestions.slice(0, 2);
}
