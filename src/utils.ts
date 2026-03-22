import type {Class} from '../cms/src/payload-types'

const weekdays: Record<string,number> = {
  "monday": 0,
  "tuesday": 1,
  "wednesday": 2,
  "thursday": 3,
  "friday": 4,
  "saturday": 5,
  "sunday": 6,
}

interface Doc<T> {
    docs: Array<T>
}

export const sortWeekdays = (a:Class, b:Class ) => weekdays[a.weekday.toLowerCase()] - weekdays[b.weekday.toLowerCase()]

export async function query<T>(collection: string): Promise<Array<T>> {
    const url = "http://localhost:3000/api/" + collection
    console.log(url)
    const res = await fetch(url) 
    const docs = await res.json() as Doc<T>
    return docs.docs
}

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