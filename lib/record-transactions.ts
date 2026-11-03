import {packHistory,unpackHistoryRecords,type HistoryRecord} from './history-wire';
import {localRequest} from './local-request';
import {readDraft,writeDraft} from './draft-storage';
import {stableJson} from './stable-json.cjs';
import type {Notebook} from './notebook';
const collections=new Set(['recordArchives','questionPages','notes','links','cards','readingNotes','crossThoughts','thoughtReplies','manuscripts','libraryBooks','libraryFolders','zoteroCollections','libraryHighlights','bookThoughts','ocrCache']);
type JsonRecord=Record<string,unknown>;
export type RecordChange={collection:string;id:string;before:unknown;after:unknown};
export const recordIdentity=(key:string,v:JsonRecord)=>key==='ocrCache'?JSON.stringify([v.libraryBookId,v.page]):key==='zoteroCollections'?JSON.stringify([v.serverId,v.key]):String(v.id);
/** Structural sharing makes the common path inspect only a changed collection.
 * Reference equality is an optimization; semantic equality still suppresses
 * normalized but unchanged records. Unloaded OCR is never inferred as removed.
 */
export function recordChanges(before:Notebook,after:Notebook):RecordChange[]{
 const result:RecordChange[]=[],a=before as unknown as JsonRecord,b=after as unknown as JsonRecord;
 for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
  if(a[key]===b[key])continue;
  if(!collections.has(key)){if(stableJson(a[key])!==stableJson(b[key]))result.push({collection:'settings',id:key,before:a[key]??null,after:b[key]??null});continue;}
  const old=new Map(((a[key]||[]) as JsonRecord[]).map(v=>[recordIdentity(key,v),v])),next=new Map(((b[key]||[]) as JsonRecord[]).map(v=>[recordIdentity(key,v),v]));
  for(const id of new Set([...old.keys(),...next.keys()])){const x=old.get(id),y=next.get(id);if(!(key==='ocrCache'&&!y)&&x!==y&&stableJson(x)!==stableJson(y))result.push({collection:key,id,before:x??null,after:y??null});}
  if(key!=='ocrCache'){const predicted=[...old.keys()].filter(id=>next.has(id)).concat([...next.keys()].filter(id=>!old.has(id)));if(JSON.stringify(predicted)!==JSON.stringify([...next.keys()]))result.push({collection:'order',id:key,before:[...old.keys()],after:[...next.keys()]});}
 }
 return result;
}
export function isRecordStorage(){return typeof document!=='undefined'&&(document.documentElement.dataset.wenjianArchitecture==='true'||document.documentElement.dataset.wenjianRecords==='true');}
export class RecordSaveError extends Error {constructor(message:string,public status:number,public current?:unknown){super(message);}}
export async function saveRecordChanges(before:Notebook,after:Notebook,version:number){
 const raw=recordChanges(before,after);const changes=await Promise.all(raw.map(async c=>{if(c.collection==='settings'||c.collection==='order')return c;const packed=await packHistory(c.before as Record<string,unknown>|null,c.after as Record<string,unknown>|null);return Object.keys(packed.history).length?{...c,...packed}:c;}));if(!changes.length)return {version};
 const fingerprint=stableJson(changes),key='record-intent:'+changes.map(c=>c.collection+':'+c.id).sort().join('|');
 // Short stable key without exposing content. Hashing identifies the record set; exact request is checked below.
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)),intentKey='intent:'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
 const previous=await readDraft<{fingerprint:string;body:string}|null>(intentKey,null);
 if(previous&&previous.fingerprint!==fingerprint){
  // Resolve the older uncertain intent before preparing a different write to the same records.
  const old=await localRequest('/api/architecture/records',{method:'POST',headers:{'Content-Type':'application/json'},body:previous.body});
  if(!old.ok){
   if(old.status===409){
    const detail:unknown=await old.json().catch(()=>null);
    const conflict=detail&&typeof detail==='object'&&'error' in detail&&typeof detail.error==='string'?detail.error:'版本冲突';
    // A confirmed conflict is terminal, not an uncertain network response.
    // Archive the exact authored request before freeing the live intent slot.
    const mutationId=JSON.parse(previous.body).mutationId;
    await writeDraft('record-conflict:'+mutationId,{...previous,at:new Date().toISOString(),error:conflict});
    await writeDraft(intentKey,null);
    throw new RecordSaveError('先前提交已有版本冲突，原提交已单独保留。请核对最新版本后重试；当前草稿仍保留。',409);
   }
   throw new RecordSaveError('先前提交需要核对，当前草稿已保留。',old.status);
  }
  await writeDraft(intentKey,null);throw new RecordSaveError('先前内容已确认保存，请核对最新版本后继续。',409);
 }
 const mutationId=previous?JSON.parse(previous.body).mutationId:crypto.randomUUID(),body=previous?.body||JSON.stringify({mutationId,version,changes,responseProtocol:1});
 await writeDraft(intentKey,{fingerprint,body});
 const start=performance.now();let response:Response|undefined;
 for(let attempt=0;attempt<2;attempt++){try{response=await localRequest('/api/architecture/records',{method:'POST',headers:{'Content-Type':'application/json'},body});break;}catch(error){if(attempt)throw error;}}
 if(!response)throw Error('提交结果尚待核对，草稿仍保留。');
 let result=await response.json() as {version:number;error?:string;records?:HistoryRecord[]};
 if(!response.ok){if(response.status===409)await writeDraft(intentKey,null);throw new RecordSaveError(result.error||'修改尚未保存，草稿仍保留。',response.status);}
 if(result.records?.some(record=>record.history)){
  try{result={...result,records:await unpackHistoryRecords(result.records,raw)};}
  catch{
   // Ask for this exact immutable receipt, not the possibly newer live record.
   const full=await localRequest('/api/architecture/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...JSON.parse(body),responseProtocol:0})});
   if(!full.ok)throw new RecordSaveError('保存已提交，完整确认仍需核对，草稿继续保留。',full.status);
   result=await full.json();if(result.records?.some(record=>record.history))throw Error('完整保存确认尚未返回，草稿继续保留。');
  }
 }
 await writeDraft(intentKey,null);
 window.dispatchEvent(new CustomEvent('wenjian:performance-sample',{detail:{kind:'save',ms:performance.now()-start,bytes:new Blob([body]).size}}));return result;
}
