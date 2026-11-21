/**
 * Client-side state of the homepage listing, shared by the toolbar, the list
 * panels and the calendar. Components never read each other's DOM; they
 * change this state and subscribe to it.
 */
import type { Tab } from '../lib/tabs';

export interface HomeState {
  tab: Tab;
  view: 'list' | 'calendar';
  /** Selected dance-style keys (see `danceKey`). Empty = no filter. */
  filters: ReadonlySet<string>;
  /** Set when arriving from a map popup (`?event=<id>`). */
  eventId: string | null;
}

export interface ChangeMeta {
  /** False for initial/deep-link state, which should apply without animation. */
  animate: boolean;
}

type Listener = (state: HomeState, previous: HomeState, meta: ChangeMeta) => void;

let state: HomeState = {
  tab: 'socials',
  view: 'list',
  filters: new Set(),
  eventId: null,
};
const listeners = new Set<Listener>();

export const getState = (): HomeState => state;

export function setState(patch: Partial<HomeState>, meta: ChangeMeta = { animate: true }) {
  const previous = state;
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state, previous, meta);
}

/**
 * Registers a listener and immediately calls it with the current state, so
 * the order in which component scripts run does not matter.
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(state, state, { animate: false });
  return () => listeners.delete(listener);
}

export function toggleFilter(key: string) {
  const filters = new Set(state.filters);
  if (filters.has(key)) filters.delete(key);
  else filters.add(key);
  setState({ filters });
}

/** Whether an item with these dance keys passes the active filters. */
export const matchesFilters = (keys: string[], filters: ReadonlySet<string>): boolean =>
  filters.size === 0 || keys.some((key) => filters.has(key));
