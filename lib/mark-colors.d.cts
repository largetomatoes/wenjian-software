export type MarkColor='yellow'|'green'|'blue'|'purple'|'orange'|'pink';
export const MARK_COLORS:{id:MarkColor;label:string;hex:string}[];
export function markColor(value?:string):{id:MarkColor;label:string;hex:string};
export function markRgba(value?:string,opacity?:number):string;
