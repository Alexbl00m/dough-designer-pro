/**
 * Recipe parameters ⇄ URL.
 *
 * Every recipe is fully described by its parameters, so the URL is the share
 * format: no backend, no accounts, and a link that still works in a year.
 * Keys are short to keep the URL readable.
 */

import { BREAD_STYLES, getStyleById } from '@/data/styles';
import type { BreadStyle } from '@/data/styles';
import type { FermentDriver, LeavenType, PercentBasis, ScaleMode } from '@/core/types';
import type { MixingMethod, YeastForm } from '@/core/constants';

export interface RecipeParams {
  styleId: string;
  scaleMode: ScaleMode;
  ballWeight: number;
  ballCount: number;
  targetFlour: number;
  targetDough: number;
  hydration: number;
  salt: number;
  sugar: number;
  oil: number;
  driver: FermentDriver;
  totalTime: number;
  leavenPct: number;
  roomTemp: number;
  coldHours: number;
  coldTemp: number;
  coldPhase: 'bulk' | 'proof';
  doughTemp: number;
  flourTemp: number | null;
  leavenType: LeavenType;
  yeastForm: YeastForm;
  mixing: MixingMethod;
  starterHydration: number;
  usePreferment: boolean;
  /** Preferment build, fridge included, in hours. */
  prefermentHours: number;
  /** Warm part of the preferment build, °C; null follows the style (or the room). */
  prefermentTemp: number | null;
  /** Hours at the end of the preferment build spent in the fridge. */
  prefermentColdHours: number;
  /**
   * Fresh yeast added to the final dough, % of total flour, when the dose is
   * what the baker holds. Null until they take hold of it.
   */
  yeastPct: number | null;
  percentBasis: PercentBasis;
}

/** Fresh parameters for a style: its own defaults, never the previous style's. */
export function paramsForStyle(style: BreadStyle): RecipeParams {
  const d = style.defaults;
  const p = style.defaultParams;
  return {
    styleId: style.id,
    scaleMode: 'pieces',
    ballWeight: d.ballWeight,
    ballCount: d.ballCount,
    targetFlour: 1000,
    targetDough: d.ballWeight * d.ballCount,
    hydration: p.hydration_pct,
    salt: p.salt_pct,
    sugar: p.sugar_pct,
    oil: p.oil_pct,
    driver: 'time',
    totalTime: d.totalTime,
    leavenPct: style.defaultLevainPct ?? 20,
    roomTemp: d.roomTemp,
    coldHours: d.coldHours,
    coldTemp: 4,
    coldPhase: style.process.coldPhase,
    doughTemp: d.doughTemp,
    flourTemp: null,
    leavenType: d.leavenType,
    yeastForm: 'instant',
    mixing: 'hand',
    starterHydration: 100,
    usePreferment: true,
    prefermentHours: style.preferment?.hours ?? 0,
    prefermentTemp: null,
    prefermentColdHours: style.preferment?.cold_hours ?? 0,
    yeastPct: null,
    percentBasis: 'total',
  };
}

const KEYS: Record<keyof RecipeParams, string> = {
  styleId: 's',
  scaleMode: 'sm',
  ballWeight: 'bw',
  ballCount: 'bc',
  targetFlour: 'tf',
  targetDough: 'td',
  hydration: 'h',
  salt: 'sa',
  sugar: 'su',
  oil: 'o',
  driver: 'dr',
  totalTime: 't',
  leavenPct: 'lp',
  roomTemp: 'rt',
  coldHours: 'ch',
  coldTemp: 'ct',
  coldPhase: 'cp',
  doughTemp: 'dt',
  flourTemp: 'ft',
  leavenType: 'lt',
  yeastForm: 'yf',
  mixing: 'm',
  starterHydration: 'sh',
  usePreferment: 'pf',
  prefermentHours: 'ph',
  prefermentTemp: 'pt',
  prefermentColdHours: 'pc',
  yeastPct: 'yp',
  percentBasis: 'pb',
};

export function paramsToQuery(params: RecipeParams): string {
  const style = getStyleById(params.styleId);
  const defaults = style ? paramsForStyle(style) : null;
  const search = new URLSearchParams();
  search.set(KEYS.styleId, params.styleId);

  // Only non-default values go in the URL, so a link stays short and readable.
  for (const [field, short] of Object.entries(KEYS) as [keyof RecipeParams, string][]) {
    if (field === 'styleId') continue;
    const value = params[field];
    if (defaults && defaults[field] === value) continue;
    if (value === null || value === undefined) continue;
    search.set(short, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  return search.toString();
}

const NUMERIC: (keyof RecipeParams)[] = [
  'ballWeight',
  'ballCount',
  'targetFlour',
  'targetDough',
  'hydration',
  'salt',
  'sugar',
  'oil',
  'totalTime',
  'leavenPct',
  'roomTemp',
  'coldHours',
  'coldTemp',
  'doughTemp',
  'starterHydration',
  'prefermentHours',
  'prefermentColdHours',
];

/** Numbers that may also be unset, meaning "follow the default". */
const NULLABLE: (keyof RecipeParams)[] = ['flourTemp', 'prefermentTemp', 'yeastPct'];

const ENUMS: Partial<Record<keyof RecipeParams, readonly string[]>> = {
  scaleMode: ['pieces', 'flour', 'dough'],
  coldPhase: ['bulk', 'proof'],
  leavenType: ['commercial', 'sourdough', 'hybrid'],
  yeastForm: ['fresh', 'active_dry', 'instant'],
  mixing: ['hand', 'dlx', 'planetary', 'spiral'],
  percentBasis: ['total', 'dough'],
  driver: ['time', 'dose'],
};

/**
 * Parse a query string back into parameters. Anything missing, malformed or out
 * of range falls back to the style's default rather than throwing — a mangled
 * link should still open a usable recipe.
 */
export function queryToParams(query: string): RecipeParams | null {
  const search = new URLSearchParams(query);
  const styleId = search.get(KEYS.styleId);
  if (!styleId) return null;
  const style = getStyleById(styleId);
  if (!style) return null;

  const params = paramsForStyle(style);

  for (const field of NUMERIC) {
    const raw = search.get(KEYS[field]);
    if (raw === null) continue;
    const value = Number(raw);
    if (Number.isFinite(value)) (params[field] as number) = value;
  }

  for (const field of NULLABLE) {
    const raw = search.get(KEYS[field]);
    if (raw === null) continue;
    const value = Number(raw);
    (params[field] as number | null) = Number.isFinite(value) ? value : null;
  }

  for (const [field, allowed] of Object.entries(ENUMS) as [keyof RecipeParams, readonly string[]][]) {
    const raw = search.get(KEYS[field]);
    if (raw !== null && allowed.includes(raw)) (params[field] as string) = raw;
  }

  const preferment = search.get(KEYS.usePreferment);
  if (preferment !== null) params.usePreferment = preferment === '1';

  return params;
}

export const DEFAULT_STYLE_ID = BREAD_STYLES[0].id;
