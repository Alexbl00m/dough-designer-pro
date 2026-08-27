/**
 * The bake log.
 *
 * Recipes are stored as parameters, not as computed results, so a saved bake
 * re-derives with the current engine instead of freezing yesterday's maths.
 * Storage is per-browser and best-effort: a blocked or full localStorage
 * degrades to an in-memory list rather than breaking the page.
 */

import type { RecipeParams } from './state';

const STORAGE_KEY = 'bakers-calculator:log';
const MAX_ENTRIES = 100;

export interface SavedBake {
  id: string;
  name: string;
  savedAt: string;
  params: RecipeParams;
  note?: string;
}

let memoryFallback: SavedBake[] | null = null;

function read(): SavedBake[] {
  if (memoryFallback) return memoryFallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SavedBake =>
        Boolean(entry) &&
        typeof (entry as SavedBake).id === 'string' &&
        typeof (entry as SavedBake).params === 'object',
    );
  } catch {
    return [];
  }
}

function write(entries: SavedBake[]): SavedBake[] {
  const trimmed = entries.slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    memoryFallback = null;
  } catch {
    // Quota exceeded or storage blocked — keep the session usable in memory.
    memoryFallback = trimmed;
  }
  return trimmed;
}

export function listBakes(): SavedBake[] {
  return read().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function saveBake(name: string, params: RecipeParams, note?: string): SavedBake {
  const entry: SavedBake = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || 'Untitled',
    savedAt: new Date().toISOString(),
    params,
    note,
  };
  write([entry, ...read()]);
  return entry;
}

export function updateBake(id: string, patch: Partial<Pick<SavedBake, 'name' | 'note'>>): void {
  write(read().map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
}

export function deleteBake(id: string): void {
  write(read().filter((entry) => entry.id !== id));
}
