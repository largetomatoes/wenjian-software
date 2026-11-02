import {packReadingDraft} from './history-wire';
import {localRequest} from './local-request';
const API_PATH = "/api/drafts";
const LOCAL_PREFIX = "wenjian:draft:";

function unsupported(status: number) {
  return status === 404 || status === 405 || status === 501;
}

function localKey(key: string) {
  if (!key.trim()) throw new Error("草稿名称不能为空。");
  return `${LOCAL_PREFIX}${key}`;
}

function browserStorage(): Storage {
  if (typeof localStorage === "undefined") throw new Error("浏览器本地存储不可用。");
  return localStorage;
}

function readLocal<T>(key: string, fallback: T): T {
  const value = browserStorage().getItem(localKey(key));
  return value === null ? fallback : JSON.parse(value) as T;
}

function writeLocal(key: string, serialized: string): void {
  browserStorage().setItem(localKey(key), serialized);
}

function serverError(response: Response): Error {
  return new Error(`草稿服务返回错误（${response.status}）。`);
}

/** Read a draft from the local app, or from browser storage when the API is absent. */
export async function readDraft<T>(key: string, fallback: T): Promise<T> {
  try {
    localKey(key);
    const response = await localRequest(API_PATH+"?key="+encodeURIComponent(key), { method: "GET", cache: "no-store" });
    if (unsupported(response.status)) return readLocal(key, fallback);
    if (!response.ok) throw serverError(response);
    const body: unknown = await response.json();
    if(body&&typeof body==="object"&&"found" in body&&"value" in body)return body.found?body.value as T:fallback;
    if (!body || typeof body !== "object" || !("drafts" in body) || !body.drafts || typeof body.drafts !== "object" || Array.isArray(body.drafts)) {
      throw new Error("草稿服务返回的数据格式不正确。");
    }
    const drafts = body.drafts as Record<string, unknown>;
    return Object.hasOwn(drafts, key) ? drafts[key] as T : fallback;
  } catch (error) {
    console.error("草稿读取失败：", error);
    throw error;
  }
}

/** Persist a JSON-serializable draft; reject so the UI can report any failure. */
const pendingDraftWrites=new Set<Promise<void>>();
const draftWriteErrors=new Map<string,unknown>(),draftRetries=new Map<string,unknown>(),queues=new Map<string,Promise<void>>();
export async function flushDraftWrites(){
 await Promise.all([...draftRetries].map(([key,value])=>writeDraft(key,value)));
 while(pendingDraftWrites.size)await Promise.all([...pendingDraftWrites]);
 if(draftWriteErrors.size)throw draftWriteErrors.values().next().value;
}
export function writeDraft(key:string,value:unknown):Promise<void>{
 // Reading histories are immutable. Snapshot editable fields while sharing those
 // arrays, so typing a draft does not stringify the entire revision archive.
 const reading=value as {note?:Record<string,unknown>;base?:Record<string,unknown>;pendingCommit?:{next:Record<string,unknown>}}|null;
 const histories:Array<{path:string[];field:string;value:unknown}>=[];
 let source=value;
 if(reading?.note&&reading.base){source={...reading,note:{...reading.note},base:{...reading.base},...(reading.pendingCommit?{pendingCommit:{...reading.pendingCommit,next:{...reading.pendingCommit.next}}}:{})};
  for(const path of [['note'],['base'],['pendingCommit','next']]){let obj=source as Record<string,unknown>;for(const segment of path){obj=obj?.[segment] as Record<string,unknown>;}if(!obj)continue;for(const field of ['revisions','anchorRevisions'])if(Array.isArray(obj[field])){histories.push({path,field,value:obj[field]});delete obj[field];}}
 }
 const captured=JSON.parse(JSON.stringify(source));for(const h of histories){let obj=captured;for(const segment of h.path)obj=obj[segment];obj[h.field]=h.value;}

 const job=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(()=>persistDraft(key,captured));queues.set(key,job);pendingDraftWrites.add(job);
 void job.then(()=>{draftWriteErrors.delete(key);draftRetries.delete(key);},error=>{draftWriteErrors.set(key,error);draftRetries.set(key,captured);}).finally(()=>{pendingDraftWrites.delete(job);if(queues.get(key)===job)queues.delete(key);});return job;
}
export async function listDrafts(bookId?:string):Promise<Record<string,unknown>>{
 const response=await localRequest(API_PATH+(bookId?'?recoveries=1&bookId='+encodeURIComponent(bookId):''),{cache:'no-store'});if(unsupported(response.status)){const result:Record<string,unknown>={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(LOCAL_PREFIX))result[k.slice(LOCAL_PREFIX.length)]=JSON.parse(localStorage.getItem(k)!);}return result;}
 if(!response.ok)throw serverError(response);const body=await response.json() as {drafts?:Record<string,unknown>};if(!body?.drafts||typeof body.drafts!=='object')throw Error('恢复稿列表暂时无法读取。');return body.drafts;
}
async function persistDraft(key: string, value: unknown): Promise<void> {
  try {
    localKey(key);
    const compact=typeof document!=='undefined'&&document.documentElement.dataset.wenjianRecords==='true'?await packReadingDraft(value):null;
    const serialized = compact?'':JSON.stringify(value);
    if (serialized === undefined) throw new Error("草稿内容无法保存为 JSON。");
    let response = await localRequest(API_PATH, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: compact?JSON.stringify({key,...compact}):'{"key":'+JSON.stringify(key)+',"value":'+serialized+'}',
    });
    if(compact&&[400,409].includes(response.status))response=await localRequest(API_PATH,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value})});
    if (unsupported(response.status)) {
      writeLocal(key, compact?JSON.stringify(value):serialized);
      return;
    }
    if (!response.ok) throw serverError(response);
  } catch (error) {
    console.error("草稿保存失败：", error);
    throw error;
  }
}
