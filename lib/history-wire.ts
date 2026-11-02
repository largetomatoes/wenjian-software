import {stableJson,sameJson} from './stable-json.cjs';
const hashes=new WeakMap<object,Promise<string>>();
async function historyHash(value:unknown[]){let saved=hashes.get(value);if(!saved){saved=crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableJson(value))).then(b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join(''));hashes.set(value,saved);}return saved;}
type Row=Record<string,unknown>;
export async function packHistory(before:Row|null,after:Row|null){
 const a=before?{...before}:null,b=after?{...after}:null,history:Record<string,{length:number;hash:string;append:unknown[]}>={};
 if(a&&b)for(const field of ['revisions','anchorRevisions']){const old=a[field],next=b[field];if(!Array.isArray(old)||!Array.isArray(next)||!old.length||next.length<old.length||!(old.every((entry,i)=>entry===next[i])||sameJson(old,next.slice(0,old.length))))continue;history[field]={length:old.length,hash:await historyHash(old),append:next.slice(old.length)};delete a[field];delete b[field];}
 return {before:a,after:b,history};
}
export async function packReadingDraft(value:unknown){
 if(!value||typeof value!=='object'||!('note' in value)||!('base' in value))return null;
 const d=value as Row,base=d.base as Row|null;if(!base?.id)return null;
 const packed={...d},refs:Record<string,unknown>={};
 for(const field of ['base','note']){const result=await packHistory(base,d[field] as Row);if(Object.keys(result.history).length){packed[field]=result.after;refs[field]=result.history;}}
 const pending=d.pendingCommit as Row|undefined;if(pending?.next){const result=await packHistory(base,pending.next as Row);if(Object.keys(result.history).length){packed.pendingCommit={...pending,next:result.after};refs.pendingCommit=result.history;}}
 if(!Object.keys(refs).length)return null;return {value:packed,historyProtocol:1,historyBaseId:base.id,historyReferences:refs};
}
