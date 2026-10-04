/**
 * Flour catalogue.
 *
 * What a baker can put in the bowl, with the two numbers that decide how long
 * a dough can mature: protein, and the Chopin W that Italian mills print on
 * the bag. W is the manufacturer's where it is published; otherwise it is
 * estimated from protein, and the app says so.
 *
 * Names are proper nouns and live in the i18n dictionaries under `flour.<id>`,
 * the same keys the styles' own blends use.
 *
 * Sources for the published figures:
 *  - Caputo Pizzeria W 260–270, 12.5%; Saccorosso W 300–320, 13–13.5%; Nuvola
 *    W 260–280, 12.5%; Manitoba Oro W 370–390, 14.5% — Caputo's specifications
 *    as collected by thehomepizzamaker.com and bienmanger.com.
 *  - Le 5 Stagioni Pizza Napoletana (red) W 310, 13.5% — pandough.app.
 *  - Polselli Classica W 260–280, 12.5% — pizzaplan.app.
 *  - Kungsörnen Pizzamjöl, 12 g protein per 100 g — kungsornen.se.
 */

export type FlourUse =
  /** Pizza flours, offered first for pizza and used for its suggestions. */
  | 'pizza'
  /** Everyday wheat flours. */
  | 'bread'
  /** Very strong flours, mostly blended in to strengthen a weaker one. */
  | 'strong'
  /** Semolina, wholegrain, rye, spelt: they do not build a white flour's gluten. */
  | 'specialty';

export interface FlourSpec {
  /** Also the i18n key, as `flour.<id>`. */
  id: string;
  /** Mill grade or type printed on the bag. */
  grade?: string;
  proteinPct: number;
  /** Published W range. */
  w?: [number, number];
  use: FlourUse;
}

export const FLOURS: FlourSpec[] = [
  // ── Pizza ──
  { id: 'caputo_pizzeria', grade: '00', proteinPct: 12.5, w: [260, 270], use: 'pizza' },
  { id: 'caputo_nuvola', grade: '0', proteinPct: 12.5, w: [260, 280], use: 'pizza' },
  { id: 'polselli_classica', grade: '00', proteinPct: 12.5, w: [260, 280], use: 'pizza' },
  { id: 'caputo_saccorosso', grade: '00', proteinPct: 13, w: [300, 320], use: 'pizza' },
  { id: 'le5stagioni_napoletana', grade: '00', proteinPct: 13.5, w: [310, 310], use: 'pizza' },
  { id: 'vigevano_oro', grade: '1', proteinPct: 13, use: 'pizza' },
  { id: 'pizzuti', grade: '00', proteinPct: 13, use: 'pizza' },
  { id: 'vigevano_tramonti', grade: '1', proteinPct: 14, use: 'pizza' },
  { id: 'kungsornen_pizza', proteinPct: 12, use: 'pizza' },
  { id: 'tipo00', grade: '00', proteinPct: 12, use: 'pizza' },

  // ── Strong ──
  { id: 'caputo_manitoba', grade: '0', proteinPct: 14.5, w: [370, 390], use: 'strong' },
  { id: 'bread_high', proteinPct: 13.5, use: 'strong' },

  // ── Everyday wheat ──
  { id: 'tipo0', grade: '0', proteinPct: 12, use: 'bread' },
  { id: 'tipo1', grade: '1', proteinPct: 12.5, use: 'bread' },
  { id: 'bread', proteinPct: 12, use: 'bread' },
  { id: 't65', grade: 'T65', proteinPct: 11.5, use: 'bread' },
  { id: 'ap', proteinPct: 10.5, use: 'bread' },

  // ── Specialty ──
  { id: 'semolina', proteinPct: 12.5, use: 'specialty' },
  { id: 'wholewheat', proteinPct: 14, use: 'specialty' },
  { id: 'spelt', proteinPct: 14, use: 'specialty' },
  { id: 'rye', proteinPct: 8, use: 'specialty' },
];

export const FLOUR_GROUPS: FlourUse[] = ['pizza', 'strong', 'bread', 'specialty'];

export const getFlour = (id: string): FlourSpec | undefined => FLOURS.find((f) => f.id === id);

/** The catalogue id behind an i18n key such as `flour.caputo_pizzeria`. */
export const flourIdOfKey = (key: string): string => key.replace(/^flour\./, '');

export const flourKey = (id: string): string => `flour.${id}`;
