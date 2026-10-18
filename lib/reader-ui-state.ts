import type {Notebook} from './notebook';
// Retain equal JSON values so unrelated progress/sync updates do not invalidate notes.
export function shareJson<T>(previous:T,incoming:T):T {
 if(Object.is(previous,incoming))return previous;
 if(!previous||!incoming||typeof previous!=='object'||typeof incoming!=='object')return incoming;
 if(Array.isArray(previous)&&Array.isArray(incoming)){
  const byId=new Map(previous.filter(value=>value&&typeof value==='object'&&typeof value.id==='string').map(value=>[value.id,value]));
  const next=incoming.map((value,index)=>shareJson(value&&typeof value==='object'&&typeof value.id==='string'?byId.get(value.id):previous[index],value));
  return (next.length===previous.length&&next.every((value,index)=>value===previous[index])?previous:next) as T;
 }
 if(Array.isArray(previous)||Array.isArray(incoming))return incoming;
 const old=previous as Record<string,unknown>,value=incoming as Record<string,unknown>,keys=Object.keys(value),next:Record<string,unknown>={...value};let changed=keys.length!==Object.keys(old).length;
 for(const key of keys){next[key]=shareJson(old[key],value[key]);if(next[key]!==old[key]||!Object.hasOwn(old,key))changed=true;}
 return (changed?next:previous) as T;
}
export const shareNotebook=(previous:Notebook,incoming:Notebook)=>shareJson(previous,incoming);
