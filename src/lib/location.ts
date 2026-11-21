/**
 * Display helpers for event/organization locations. The CMS stores address
 * parts (see cms/src/lib/location.ts); locations saved before that only have
 * a long Nominatim string in `address`, which is shown as is.
 */
import { streetLine } from '../../cms/src/lib/location';
import type { PublicLocation } from '../../cms/src/lib/occurrences/types';

type Location = PublicLocation | null | undefined;

/** Stadtteil, falling back to the city: "Sternschanze". */
export const areaLabel = (location: Location): string | null =>
  location?.district || location?.city || null;

/** "Schulterblatt 73, Sternschanze" — the compact line used on cards and the map. */
export function shortAddress(location: Location): string | null {
  if (!location) return null;
  const line = [streetLine(location), areaLabel(location)].filter(Boolean).join(', ');
  return line || location.address || null;
}

/** "Haus73 · Sternschanze" — venue and area, for tight spaces like dialogs. */
export function venueLine(location: Location): string {
  return [...new Set([location?.name, areaLabel(location)].filter(Boolean))].join(' · ');
}
