import { PayloadSDK } from '@payloadcms/sdk';
import type { Config, Class } from '../cms/src/payload-types'; 


export const payload = new PayloadSDK<Config>({
  baseURL: process.env.PAYLOAD_URL || 'http://localhost:3000/api',
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
        return t[d]
    } else {
        return d
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