import type {Notebook} from './notebook';
const collections=new Set(['recordArchives','questionPages','notes','links','cards','readingNotes','crossThoughts','thoughtReplies','manuscripts','libraryBooks','libraryFolders','zoteroCollections','libraryHighlights','bookThoughts','ocrCache']);
type JsonRecord=Record<string,unknown>;
export type RecordChange={collection:string;id:string;before:unknown;after:unknown};
const identity=(key:string,v:JsonRecord)=>key==='ocrCache'?JSON.stringify([v.libraryBookId,v.page]):key==='zoteroCollections'?JSON.stringify([v.serverId,v.key]):String(v.id);
/** Structural sharing makes the common path inspect only a changed collection.
 * Reference equality is an optimization; semantic equality still suppresses
 * normalized but unchanged records. Unloaded OCR is never inferred as removed.
 */
export function recordChanges(before:Notebook,after:Notebook):RecordChange[]{
 const result:RecordChange[]=[],a=before as unknown as JsonRecord,b=after as unknown as JsonRecord;
 for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
  if(a[key]===b[key])continue;
  if(!collections.has(key)){if(JSON.stringify(a[key])!==JSON.stringify(b[key]))result.push({collection:'settings',id:key,before:a[key]??null,after:b[key]??null});continue;}
  const old=new Map(((a[key]||[]) as JsonRecord[]).map(v=>[identity(key,v),v])),next=new Map(((b[key]||[]) as JsonRecord[]).map(v=>[identity(key,v),v]));
  for(const id of new Set([...old.keys(),...next.keys()])){const x=old.get(id),y=next.get(id);if(!(key==='ocrCache'&&!y)&&x!==y&&JSON.stringify(x)!==JSON.stringify(y))result.push({collection:key,id,before:x??null,after:y??null});}
  if(key!=='ocrCache'){const predicted=[...old.keys()].filter(id=>next.has(id)).concat([...next.keys()].filter(id=>!old.has(id)));if(JSON.stringify(predicted)!==JSON.stringify([...next.keys()]))result.push({collection:'order',id:key,before:[...old.keys()],after:[...next.keys()]});}
 }
 return result;
}
export function isRecordStorage(){return typeof document!=='undefined'&&(document.documentElement.dataset.wenjianArchitecture==='true'||document.documentElement.dataset.wenjianRecords==='true');}
export async function saveRecordChanges(before:Notebook,after:Notebook,version:number){
 const changes=recordChanges(before,after);if(!changes.length)return {version};
 const mutationId=crypto.randomUUID(),body=JSON.stringify({mutationId,version,changes});
 const start=performance.now();let response:Response|undefined;
 // A lost response may follow a successful commit. Reuse the same ID; the
 // database returns its durable receipt without adding another revision.
 for(let attempt=0;attempt<2;attempt++){try{response=await fetch('/api/architecture/records',{method:'POST',headers:{'Content-Type':'application/json'},body});break;}catch(error){if(attempt)throw error;}}
 if(!response)throw Error('本地记录服务没有响应，草稿仍保留。');
 const result=await response.json() as {version:number;error?:string};
 if(!response.ok)throw Error(result.error||'这次修改尚未保存，草稿仍保留。');
 window.dispatchEvent(new CustomEvent('wenjian:performance-sample',{detail:{kind:'save',ms:performance.now()-start,bytes:new Blob([body]).size}}));return result;
}
