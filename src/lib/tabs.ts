import type { EventType } from '../../cms/src/lib/occurrences/types';

/** Homepage tabs, in display order. Shared by the server render and client scripts. */
export const TABS = ['socials', 'events', 'classes'] as const;
export type Tab = (typeof TABS)[number];

export const TAB_TYPES: Record<Tab, EventType> = {
  socials: 'social',
  events: 'event',
  classes: 'class',
};

export const isTab = (value: unknown): value is Tab => TABS.includes(value as Tab);
