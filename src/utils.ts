import { PayloadSDK } from '@payloadcms/sdk';
import type { Config, Class } from '../cms/src/payload-types'; 


export const payload = new PayloadSDK<Config>({
  baseURL: import.meta.env.PAYLOAD_URL || 'http://localhost:3000',
});


const weekdays: Record<string,number> = {
  "monday": 0,
  "tuesday": 1,
  "wednesday": 2,
  "thursday": 3,
  "friday": 4,
  "saturday": 5,
  "sunday": 6,
}

export const translateWeekday = (d:string, locale: string) => {
    const t: Record<string, string> = {
        "monday": "Montag",
        "tuesday": "Dienstag",
        "wednesday": "Mittwoch",
        "thursday": "Donnerstag",
        "friday": "Freitag",
        "saturday": "Samstag",
        "sunday": "Sonntag",
    }

    if (locale == 'de') {
        return t[d.toLowerCase()]
    } else {
        return d.charAt(0).toUpperCase() + d.slice(1)
    }

}


interface Doc<T> {
    docs: Array<T>
}

export const sortWeekdays = (a:Class, b:Class ) => weekdays[a.weekday.toLowerCase()] - weekdays[b.weekday.toLowerCase()]


export function collect<T>(keyer: (arg: T)=>string) {
    return function(acc: Record<string,T[]>, curr: T) :Record<string,T[]> {
        const key = keyer(curr);
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(curr);
        return acc;
    }
}

/**
 * Simple Seeded Random Number Generator (LCG)
 * Returns a function that mimics Math.random() but is deterministic.
 */
function createSeededRandom(seed: number) {
  return function() {
    // Standard LCG parameters (Numerical Recipes)
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/**
 * Shuffles an array deterministically using a daily numeric seed.
 */
export function shuffleByDay<T>(array: T[]): T[] {
  const shuffled = [...array];
  
  // 1. Generate a stable seed based on Year, Month, and Day (YYYYMMDD)
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1; // 0-11 to 1-12
  const day = today.getUTCDate();
  
  const dailySeed = year * 10000 + month * 100 + day; // e.g., 20260607
  
  // 2. Initialize our seeded random number stream
  const seededRandom = createSeededRandom(dailySeed);

  // 3. Perform Fisher-Yates shuffle using the seeded random function
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}