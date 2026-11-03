'use strict';
// Only the isolated architecture preview enables this adapter. The worker owns
// the database; renderers exchange changed records, never the live database.
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const collections=new Set(['recordArchives','questionPages','notes','links','cards','readingNotes','crossThoughts','thoughtReplies','manuscripts','libraryBooks','libraryFolders','zoteroCollections','libraryHighlights','bookThoughts','ocrCache']);
const historyFields=['revisions','anchorRevisions'];
function stable(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(x=>stable(x)??'null').join(',')+']';return '{'+Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';}
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'?v:stable(v)).digest('hex');
function recordId(collection,v){const id=collection==='ocrCache'?JSON.stringify([v.libraryBookId,v.page]):collection==='zoteroCollections'?JSON.stringify([v.serverId,v.key]):v.id;if(typeof id!=='string'||!id||id.length>2000)throw Error('记录编号不正确。');return id;}
function readLegacy(file,kind='notebook'){
 const raw=fs.existsSync(file)?fs.readFileSync(file):Buffer.from('{}'),value=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')),journal=file+'.wj-journal';
 if(!fs.existsSync(journal))return value;
 const bytes=fs.readFileSync(journal),end=bytes.lastIndexOf(10);if(end<0)throw Error('旧事务日志不完整，未迁移。');
 const lines=bytes.subarray(0,end).toString('utf8').split('\n'),header=JSON.parse(lines.shift());
 if(header.schema!==1||header.kind!==kind)throw Error('旧事务日志格式不正确。');
 const ops=lines.filter(Boolean).map((line,i)=>{const r=JSON.parse(line);if(hash(r.payload)!==r.sha256)throw Error('旧事务日志校验失败。');const op=JSON.parse(r.payload);if(op.sequence!==i+1)throw Error('旧事务日志次序不正确。');return op;});
 if(crypto.createHash('sha256').update(raw).digest('hex')!==header.baseHash){
  const marker=kind==='notebook'?value._windowsCheckpoint:fs.existsSync(file+'.wj-checkpoint')?JSON.parse(fs.readFileSync(file+'.wj-checkpoint','utf8')):null;
  if(marker?.id===header.id&&marker.sequence===ops.length&&(kind!=='draft'||marker.sha256===crypto.createHash('sha256').update(raw).digest('hex')))return value;
  throw Error('旧资料与日志不一致，保留原件并停止迁移。');
 }
 for(const op of ops){
  if(kind==='draft'){if(op.value===null)delete value[op.key];else Object.defineProperty(value,op.key,{value:op.value,enumerable:true,writable:true,configurable:true});continue;}
  if(value.version!==op.baseVersion)throw Error('旧日志版本不一致。');
  if(op.kind==='ocr'){value.data.ocrCache=[...(value.data.ocrCache||[]).filter(e=>e.libraryBookId!==op.entry.libraryBookId||e.page!==op.entry.page),op.entry];}
  else if(op.kind==='progress'){const byId=new Map(op.items.map(i=>[i.id,i.progress]));value.data.libraryBooks=value.data.libraryBooks.map(b=>byId.has(b.id)?{...b,progress:{...b.progress,...byId.get(b.id)}}:b);}
  else throw Error('旧日志含未知操作。');value.version=op.version;
 }
 return value;
}
function atomic(file,value){const temporary=file+'.architecture-new';const fd=fs.openSync(temporary,'w',0o600);try{fs.writeFileSync(fd,JSON.stringify(value)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temporary,file);}
function legacyFingerprint(file,draftsFile){return [file,draftsFile].filter(Boolean).flatMap(source=>['','.wj-journal','.wj-checkpoint'].map(suffix=>{try{const s=fs.statSync(source+suffix,{bigint:true});return [String(s.ino),String(s.size),String(s.mtimeNs),String(s.ctimeNs)];}catch(error){if(error.code==='ENOENT')return null;throw error;}}));}
function createStore({file,draftsFile,database=file+'.sqlite3',validateTransition=()=>'',normalizeNotebook=null,fault=()=>{},legacyGuardFile=file,legacyGuardDrafts=draftsFile}){
 const db=new DatabaseSync(database);
 if(db.prepare("SELECT name FROM sqlite_master WHERE name='blobs'").get()&&!db.prepare("SELECT name FROM sqlite_master WHERE name='blob_history_heads'").get()){
  const folder=path.join(path.dirname(database),'record-schema-safeguards');fs.mkdirSync(folder,{recursive:true,mode:0o700});const recovery=path.join(folder,'before-linked-history-'+crypto.randomUUID()+'.sqlite3');db.prepare('VACUUM INTO ?').run(recovery);fs.chmodSync(recovery,0o600);
 }
 db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
 db.exec(`CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS blobs(hash TEXT PRIMARY KEY,json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS blob_history_heads(hash TEXT NOT NULL,field TEXT NOT NULL,head TEXT NOT NULL,PRIMARY KEY(hash,field));
 CREATE TABLE IF NOT EXISTS history_nodes(hash TEXT PRIMARY KEY,previous TEXT,entry TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS records(collection TEXT NOT NULL,id TEXT NOT NULL,json TEXT NOT NULL,history TEXT NOT NULL,hash TEXT NOT NULL,revision INTEGER NOT NULL,rank INTEGER NOT NULL,PRIMARY KEY(collection,id));
 CREATE TABLE IF NOT EXISTS drafts(key TEXT PRIMARY KEY,json TEXT NOT NULL,hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS outbox(sequence INTEGER PRIMARY KEY AUTOINCREMENT,mutation_id TEXT NOT NULL,collection TEXT NOT NULL,record_id TEXT NOT NULL,before_hash TEXT,after_hash TEXT,at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS versions(sequence INTEGER PRIMARY KEY AUTOINCREMENT,collection TEXT NOT NULL,record_id TEXT NOT NULL,revision INTEGER NOT NULL,blob_hash TEXT,at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,json TEXT NOT NULL);
 CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(collection UNINDEXED,id UNINDEXED,title,body,book UNINDEXED,chapter UNINDEXED,tokenize='trigram');`);
 let cachedLight=null;
 const q=sql=>db.prepare(sql),getMeta=(key,fallback=null)=>{const row=q('SELECT json FROM meta WHERE key=?').get(key);return row?JSON.parse(row.json):fallback;};
 const meta=(key,value)=>q('INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json').run(key,JSON.stringify(value));
 function readBlob(id){const row=q('SELECT json FROM blobs WHERE hash=?').get(id);if(!row)throw Error('历史内容缺失，已停止载入。');const value=JSON.parse(row.json);for(const {field,head} of q('SELECT field,head FROM blob_history_heads WHERE hash=?').all(id)){const entries=[];let cursor=head;while(cursor){const node=q('SELECT previous,entry FROM history_nodes WHERE hash=?').get(cursor);if(!node)throw Error('历史链缺失，已停止载入。');entries.push(readBlob(node.entry));cursor=node.previous;}value[field]=entries.reverse();}return value;}
 function putBlob(value){const text=stable(value),id=hash(text);if(q('SELECT hash FROM blobs WHERE hash=?').get(id))return id;
  const payload=value&&typeof value==='object'&&!Array.isArray(value)?{...value}:value,heads=[];
  for(const field of historyFields)if(Array.isArray(payload?.[field])){let head='';for(const entry of payload[field]){const blob=putBlob(entry),node=hash([head,blob]);q('INSERT OR IGNORE INTO history_nodes VALUES(?,?,?)').run(node,head,blob);head=node;}heads.push([field,head]);delete payload[field];}
  q('INSERT INTO blobs VALUES(?,?)').run(id,stable(payload));for(const [field,head]of heads)q('INSERT INTO blob_history_heads VALUES(?,?,?)').run(id,field,head);return id;
 }
 function expandHistory(record,references,base,side){const result={...record};for(const [field,ref]of Object.entries(references||{})){if(!historyFields.includes(field)||!Number.isInteger(ref.length)||ref.length<0||!Array.isArray(ref.append))throw Error('历史引用格式不正确。');const prefix=(base?.[field]||[]).slice(0,ref.length);if(prefix.length!==ref.length||hash(prefix)!==ref.hash){const e=Error('历史版本需要核对，完整草稿保留。');e.status=409;throw e;}result[field]=side==='before'?prefix:[...prefix,...ref.append];}return result;}
 function encodeDraft(value){if(!value?.note||!value.base)return JSON.stringify(value);const draft={...value},refs={};for(const field of ['note','base'])if(draft[field]){refs[field]=putBlob(draft[field]);delete draft[field];}if(draft.pendingCommit?.next){draft.pendingCommit={...draft.pendingCommit};refs.pendingCommit=putBlob(draft.pendingCommit.next);delete draft.pendingCommit.next;}return JSON.stringify({draftEncoding:1,draft,refs});}
 function decodeDraft(text){const v=JSON.parse(text);if(v?.draftEncoding!==1||!v.refs||!v.draft)return v;const result={...v.draft};for(const [field,ref]of Object.entries(v.refs)){if(field==='pendingCommit')result.pendingCommit={...result.pendingCommit,next:readBlob(ref)};else result[field]=readBlob(ref);}return result;}
 function decode(row){if(!row)return null;const v=JSON.parse(row.json.startsWith('@')?q('SELECT json FROM blobs WHERE hash=?').get(row.json.slice(1)).json:row.json);for(const [key,ids]of Object.entries(JSON.parse(row.history)))v[key]=ids.map(id=>readBlob(id));return v;}
 function get(collection,id){return decode(q('SELECT * FROM records WHERE collection=? AND id=?').get(collection,id));}
 function index(collection,id,value){q('DELETE FROM search_index WHERE collection=? AND id=?').run(collection,id);if(collection==='ocrCache'||!value)return;const title=value.title||value.composition?.title||value.bookTitle||value.book||'',body=[value.body,value.text,value.interpretation,value.quote,...(value.thoughts||[]).map(t=>t.text)].filter(Boolean).join('\n');q('INSERT INTO search_index(collection,id,title,body,book,chapter) VALUES(?,?,?,?,?,?)').run(collection,id,title,body,value.libraryBookId||value.composition?.homeBookId||'',value.chapter||'');}
 function put(collection,id,value,revision=1,rank){
  cachedLight=null;
  const current=q('SELECT rank FROM records WHERE collection=? AND id=?').get(collection,id);if(value===null){q('DELETE FROM records WHERE collection=? AND id=?').run(collection,id);index(collection,id,null);return;}
  const payload={...value},hist={};for(const key of historyFields)if(Array.isArray(payload[key])){hist[key]=payload[key].map(putBlob);delete payload[key];}
  const position=rank??current?.rank??(q('SELECT coalesce(max(rank),-1)+1 n FROM records WHERE collection=?').get(collection).n);
  q('INSERT INTO records VALUES(?,?,?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET json=excluded.json,history=excluded.history,hash=excluded.hash,revision=excluded.revision,rank=excluded.rank').run(collection,id,'@'+putBlob(payload),JSON.stringify(hist),hash(value),revision,position);index(collection,id,value);
 }
 function storeEnvelope(extra){
  meta('envelopeKeys',Object.keys(extra));for(const [key,value]of Object.entries(extra)){
   if(key!=='sync'||!value||typeof value!=='object'){meta('envelope:'+key,value);continue;}
   const encoded={...value};for(const field of ['operations','pending'])if(Array.isArray(value[field]))encoded[field]=value[field].map(op=>{const {value:item,...metadata}=op;return Object.hasOwn(op,'value')?{metadata,blob:putBlob(item)}:{raw:putBlob(op)};});
   if(value.observed&&typeof value.observed==='object')encoded.observed=Object.fromEntries(Object.entries(value.observed).map(([k,v])=>[k,putBlob(v)]));meta('envelope:sync',encoded);
  }
 }
 function envelope(){const extra={};for(const key of getMeta('envelopeKeys',[])){let value=getMeta('envelope:'+key);if(key==='sync'&&value&&typeof value==='object'){value={...value};for(const field of ['operations','pending'])if(Array.isArray(value[field]))value[field]=value[field].map(v=>v.raw?readBlob(v.raw):{...v.metadata,value:readBlob(v.blob)});if(value.observed&&typeof value.observed==='object')value.observed=Object.fromEntries(Object.entries(value.observed).map(([k,h])=>[k,readBlob(h)]));}extra[key]=value;}return extra;}
 function snapshot({includeOcr=true}={}){const data={};for(const key of getMeta('dataKeys',[]))data[key]=collections.has(key)?q('SELECT * FROM records WHERE collection=? ORDER BY rank,id').all(key).map(decode):getMeta('data:'+key);if(!includeOcr)data.ocrCache=[];return {...envelope(),version:getMeta('version',0),data};}
 function lightData(){if(cachedLight)return cachedLight;const data={};for(const key of getMeta('dataKeys',[]))data[key]=collections.has(key)?key==='ocrCache'?[]:q('SELECT * FROM records WHERE collection=? ORDER BY rank,id').all(key).map(decode):getMeta('data:'+key);cachedLight=data;return data;}
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();fault('before-commit');db.exec('COMMIT');return result;}catch(e){cachedLight=null;db.exec('ROLLBACK');throw e;}}
 function importSnapshot(envelope,drafts={},restore=false){
  if(!Number.isInteger(envelope?.version)||!envelope.data||!Array.isArray(envelope.data.notes)||!drafts||typeof drafts!=='object'||Array.isArray(drafts))throw Error('迁移资料格式不正确。');
  transaction(()=>{if(restore){q('DELETE FROM records').run();q('DELETE FROM drafts').run();q('DELETE FROM search_index').run();q('DELETE FROM receipts').run();q('DELETE FROM outbox').run();}
   const keys=Object.keys(envelope.data);meta('dataKeys',keys);for(const key of keys){const value=envelope.data[key];if(collections.has(key)){if(!Array.isArray(value))throw Error('资料集合格式不正确：'+key);const seen=new Set();for(const [rank,item]of value.entries()){const id=recordId(key,item);if(seen.has(id))throw Error('重复记录，未迁移：'+key);seen.add(id);put(key,id,item,1,rank);}}else meta('data:'+key,value);}
   for(const [key,value]of Object.entries(drafts))q('INSERT INTO drafts VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json,hash=excluded.hash').run(key,JSON.stringify(value),hash(value));
   const {data,version,...extra}=envelope;meta('version',version);storeEnvelope(extra);
   // Compare every field, including all historic expressions, coordinates and
   // synchronization bookkeeping, before considering the migration complete.
   if(stable(snapshot())!==stable(envelope))throw Error('迁移核对失败，旧资料未修改。');
   for(const [key,value]of Object.entries(drafts))if(hash(value)!==q('SELECT hash FROM drafts WHERE key=?').get(key)?.hash)throw Error('草稿迁移核对失败。');
   meta('normalizedModel',0);meta('migration',{schema:1,at:new Date().toISOString(),sourceHash:hash(envelope),draftHash:hash(drafts)});
  });
 }
 const guardedFiles=[legacyGuardFile,legacyGuardDrafts].filter(Boolean).flatMap(f=>['','.wj-journal','.wj-checkpoint'].map(s=>f+s));
 const fileHash=f=>{try{return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');}catch(e){if(e.code==='ENOENT')return null;throw e;}};
 function exportSnapshot(){
  const value=snapshot(),drafts=operation('draft-read'),targets=[{file,value},...(draftsFile?[{file:draftsFile,value:drafts}]:[])];
  const before=Object.fromEntries(guardedFiles.map(f=>[f,fileHash(f)])),after={...before};for(const t of targets)after[t.file]=crypto.createHash('sha256').update(JSON.stringify(t.value)+'\n').digest('hex');
  meta('exportIntent',{before,after});
  for(const t of targets)atomic(t.file,t.value);
  transaction(()=>{meta('legacyFileState',legacyState());meta('exportIntent',null);});
  db.exec('PRAGMA wal_checkpoint(PASSIVE)');return {version:value.version,notebookHash:hash(value),draftHash:hash(drafts)};
 }
 const legacyState=()=>legacyFingerprint(legacyGuardFile,legacyGuardDrafts);
 try{if(!getMeta('migration'))importSnapshot(readLegacy(file),draftsFile?readLegacy(draftsFile,'draft'):{});
  const saved=getMeta('legacyFileState'),current=legacyState();
  if(saved&&stable(saved)!==stable(current)){
   const intent=getMeta('exportIntent');
   const ownExport=intent&&guardedFiles.every(f=>[intent.before[f],intent.after[f]].includes(fileHash(f)));
   // Recover old builds' interrupted export only when every changed file exactly matches SQLite.
   const legacyEquivalent=!intent&&guardedFiles.every((f,i)=>stable(saved[i])===stable(current[i])||(f===file&&stable(readLegacy(file))===stable(snapshot()))||(f===draftsFile&&stable(readLegacy(draftsFile,'draft'))===stable(operation('draft-read'))));
   if(ownExport||legacyEquivalent){exportSnapshot();}else throw Error('检测到旧版软件或外部工具改动了旧资料文件。为避免覆盖任何一份记录，问间已停止载入；请保留原文件与 SQLite 数据库，通过完整备份核对恢复。');
  }
  if(!saved)meta('legacyFileState',current);
 }catch(error){db.close();throw error;}
 function normalizeImported(){if(!normalizeNotebook||getMeta('normalizedModel')===1)return;const before=snapshot(),data=normalizeNotebook(before.data);if(stable(data)!==stable(before.data))operation('write',{value:{...before,version:before.version+1,data}});meta('normalizedModel',1);}
 normalizeImported();
 function clientReceipt(receipt,changes,protocol){
  if(protocol!==1||!receipt.records)return receipt;
  const requested=new Map(changes.map(c=>[c.collection+':'+c.id,c]));
  return {...receipt,records:receipt.records.map(row=>{
   if(!row.value)return row;const refs=requested.get(row.collection+':'+row.id)?.history;if(!refs)return row;
   const value={...row.value},history={};
   for(const [field,ref]of Object.entries(refs)){
    const all=value[field];if(!historyFields.includes(field)||!Array.isArray(all)||all.length<ref.length||hash(all.slice(0,ref.length))!==ref.hash)continue;
    history[field]={length:ref.length,hash:ref.hash,append:all.slice(ref.length)};delete value[field];
   }
   return Object.keys(history).length?{...row,value,history}:row;
  })};
 }
 function patch(input){
  if(!input||typeof input.mutationId!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(input.mutationId)||!Array.isArray(input.changes)||input.changes.length>10000)throw Error('记录事务格式不正确。');
  const responseProtocol=input.responseProtocol,requestHash=hash(input.changes),previous=q('SELECT * FROM receipts WHERE id=?').get(input.mutationId);if(previous){if(previous.request_hash!==requestHash)throw Error('操作编号重复但内容不同。');const saved=JSON.parse(previous.json);if(saved.recordBlobs){saved.records=saved.recordBlobs.map(r=>({collection:r.collection,id:r.id,value:r.blob===null?null:readBlob(r.blob)}));delete saved.recordBlobs;}return clientReceipt(saved,input.changes,responseProtocol);}
  const wireChanges=input.changes;
  input={...input,changes:wireChanges.map(c=>{if(!c.history)return c;const base=get(c.collection,c.id);return {...c,before:expandHistory(c.before,c.history,base,'before'),after:expandHistory(c.after,c.history,base,'after')};})};
  let committedLight;const receipt=transaction(()=>{
   const current=lightData(),next={...current},seen=new Set(),applied=[],orders=[];
   for(const change of input.changes){const {collection,id,before,after}=change,key=collection+'/'+id;if(seen.has(key))throw Error('同一事务重复修改记录。');seen.add(key);
    if(collection==='order'){
     if(!collections.has(id)||id==='ocrCache'||!Array.isArray(before)||!Array.isArray(after)||new Set(after).size!==after.length)throw Error('集合排序格式不正确。');
     const oldIds=(current[id]||[]).map(v=>recordId(id,v));if(stable(oldIds)!==stable(before)){const e=Error('该列表刚有变化，请重新核对排序。');e.status=409;throw e;}
     orders.push(change);continue;
    }
    if(collection==='settings'){if(collections.has(id)||!['setupCompleted','zoteroEnabled','dismissedSuggestions','organizationVersion','viewPageId','externalLabels'].includes(id)||after===undefined)throw Error('未知资料设置。');if(stable(current[id]??null)!==stable(before)){const e=Error('这项设置已有新版本，当前草稿保留。');e.status=409;throw e;}next[id]=after;applied.push(change);continue;}
    if(!collections.has(collection)||typeof id!=='string'||before===undefined||after===undefined||after!==null&&recordId(collection,after)!==id)throw Error('记录事务缺少有效内容。');
    const stored=get(collection,id);if(stable(stored)===stable(after))continue;if(stable(stored)!==stable(before)){const e=Error('这条记录已有新版本，当前输入与草稿保留，请核对后重试。');e.status=409;throw e;}
    if(stable(before)===stable(after))continue;
    if(collection!=='ocrCache'){const list=next[collection]||[];next[collection]=list.filter(v=>recordId(collection,v)!==id);if(after!==null){const i=list.findIndex(v=>recordId(collection,v)===id);if(i<0)next[collection].push(after);else next[collection].splice(i,0,after);}}
    applied.push(change);
   }
   for(const change of orders){const list=next[change.id]||[],byId=new Map(list.map(v=>[recordId(change.id,v),v]));if(change.after.length!==list.length||change.after.some(id=>!byId.has(id)))throw Error('排序不能遗漏或新增记录。');next[change.id]=change.after.map(id=>byId.get(id));applied.push(change);}
   const error=validateTransition(current,next);if(error)throw Error(error);
   const version=getMeta('version',0)+(applied.length?1:0),at=new Date().toISOString();
   for(const change of applied){const {collection,id,before,after}=change;
    if(collection==='order'){after.forEach((key,rank)=>q('UPDATE records SET rank=? WHERE collection=? AND id=?').run(rank,id,key));}else if(collection==='settings'){cachedLight=null;meta('data:'+id,after);}else{const old=q('SELECT revision FROM records WHERE collection=? AND id=?').get(collection,id),revision=(old?.revision||0)+1;if(before!==null)q('INSERT INTO versions(collection,record_id,revision,blob_hash,at) VALUES(?,?,?,?,?)').run(collection,id,revision-1,putBlob(before),at);put(collection,id,after,revision);}
    q('INSERT INTO outbox(mutation_id,collection,record_id,before_hash,after_hash,at) VALUES(?,?,?,?,?,?)').run(input.mutationId,collection,id,before===null?null:putBlob(before),after===null?null:putBlob(after),at);
   }
   meta('dataKeys',[...new Set([...getMeta('dataKeys',[]),...applied.map(c=>c.collection==='settings'||c.collection==='order'?c.id:c.collection)])]);meta('version',version);const result={version,mutationId:input.mutationId,savedAt:at,changed:applied.map(c=>({collection:c.collection,id:c.id})),records:input.changes.filter(c=>collections.has(c.collection)).map(c=>({collection:c.collection,id:c.id,value:get(c.collection,c.id)}))};const durable={...result,records:undefined,recordBlobs:result.records.map(r=>({collection:r.collection,id:r.id,blob:r.value===null?null:putBlob(r.value)}))};q('INSERT INTO receipts VALUES(?,?,?)').run(input.mutationId,requestHash,JSON.stringify(durable));committedLight=next;return result;
  });cachedLight=committedLight;return clientReceipt(receipt,wireChanges,responseProtocol);
 }
 function operation(type,input={}){
  if(type==='read')return snapshot();
  if(type==='snapshot')return {version:getMeta('version',0),data:lightData(),storage:'local',architecture:1};
  if(type==='revision')return {version:getMeta('version',0),syncRevision:getMeta('envelope:syncRevision',0)};
  if(type==='records')return patch(input);
  if(type==='receipt'){const row=q('SELECT json FROM receipts WHERE id=?').get(input.mutationId);return {found:!!row,receipt:row?JSON.parse(row.json):null};}
  if(type==='record')return {value:get(input.collection,input.id)};
  if(type==='ocr-text')return {entries:q("SELECT json_extract(b.json,'$.libraryBookId') libraryBookId,json_extract(b.json,'$.page') page,json_extract(b.json,'$.text') text,json_extract(b.json,'$.preferOcr') preferOcr,json_extract(b.json,'$.at') at FROM records r JOIN blobs b ON substr(r.json,2)=b.hash WHERE r.collection='ocrCache' AND json_extract(b.json,'$.libraryBookId')=?").all(input.bookId)};
  if(type==='ocr-page'){const id=JSON.stringify([input.bookId,input.page]);return {entry:get('ocrCache',id)};}
  if(type==='books')return q("SELECT * FROM records WHERE collection='libraryBooks' ORDER BY rank").all().map(decode).map(({id,storedFile,format,cloudFile})=>({id,storedFile,format,cloudFile}));
  if(type==='draft-recoveries'){const rows=q("SELECT key,json FROM drafts WHERE key LIKE 'recovery:%' OR key LIKE '%:recovered:%'").all();return {drafts:Object.fromEntries(rows.map(r=>[r.key,decodeDraft(r.json)]).filter(([,v])=>v?.note?.libraryBookId===input.bookId))};}
  if(type==='draft-get'){const row=q('SELECT json FROM drafts WHERE key=?').get(input.key);return {found:!!row,value:row?decodeDraft(row.json):null};}
  if(type==='draft-read')return Object.fromEntries(q('SELECT key,json FROM drafts').all().map(r=>[r.key,decodeDraft(r.json)]));
  if(type==='draft-write'){if(!input.value||typeof input.value!=='object'||Array.isArray(input.value))throw Error('草稿集合不正确。');return transaction(()=>{q('DELETE FROM drafts').run();for(const [key,value]of Object.entries(input.value)){if(['__proto__','constructor','prototype'].includes(key))throw Error('草稿名称不正确。');q('INSERT INTO drafts VALUES(?,?,?)').run(key,encodeDraft(value),hash(value));}return {ok:true};});}
  if(type==='draft-set'){
   if(typeof input.key!=='string'||!input.key||['__proto__','constructor','prototype'].includes(input.key)||input.value===undefined)throw Error('草稿内容不正确。');
   return transaction(()=>{let value=input.value;if(input.historyProtocol===1){const base=get('bookThoughts',input.historyBaseId),refs=input.historyReferences||{};value={...value};for(const field of ['base','note'])if(refs[field])value[field]=expandHistory(value[field],refs[field],base,'after');if(refs.pendingCommit)value.pendingCommit={...value.pendingCommit,next:expandHistory(value.pendingCommit.next,refs.pendingCommit,base,'after')};}
    const text=encodeDraft(value);if(Buffer.byteLength(text)>32*1024*1024)throw Error('单份草稿超过 32 MB，尚未保存。');if(value===null)q('DELETE FROM drafts WHERE key=?').run(input.key);else q('INSERT INTO drafts VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json,hash=excluded.hash').run(input.key,text,hash(value));return {saved:true};});
  }
  if(type==='write')return transaction(()=>{
   cachedLight=null;const value=input.value,keys=Object.keys(value.data),mutationId=crypto.randomUUID(),at=new Date().toISOString();
   const ledger=(collection,id,before,after,revision)=>{if(before!==null)q('INSERT INTO versions(collection,record_id,revision,blob_hash,at) VALUES(?,?,?,?,?)').run(collection,id,revision,putBlob(before),at);q('INSERT INTO outbox(mutation_id,collection,record_id,before_hash,after_hash,at) VALUES(?,?,?,?,?,?)').run(mutationId,collection,id,before===null?null:putBlob(before),after===null?null:putBlob(after),at);};
   for(const key of keys)if(collections.has(key)){
    const ids=new Set();for(const [rank,item]of value.data[key].entries()){const id=recordId(key,item);ids.add(id);const row=q('SELECT * FROM records WHERE collection=? AND id=?').get(key,id);if(!row||row.hash!==hash(item)){ledger(key,id,decode(row),item,row?.revision||0);put(key,id,item,(row?.revision||0)+1,rank);}else if(row.rank!==rank)q('UPDATE records SET rank=? WHERE collection=? AND id=?').run(rank,key,id);}
    for(const row of q('SELECT * FROM records WHERE collection=?').all(key))if(!ids.has(row.id)){ledger(key,row.id,decode(row),null,row.revision);put(key,row.id,null);}
   }else{const before=getMeta('data:'+key);if(stable(before)!==stable(value.data[key]))ledger('settings',key,before,value.data[key],0);meta('data:'+key,value.data[key]);}
   meta('dataKeys',keys);const {data,version,...extra}=value;meta('version',version);storeEnvelope(extra);return {ok:true};
  });
  if(type==='ocr'||type==='progress'){
   // OCR and reading progress retain their old delta response contract.
   if(input.version!==getMeta('version',0))return {conflict:true,version:getMeta('version',0)};
   if(type==='ocr'){if(!get('libraryBooks',input.entry.libraryBookId))return {missing:true};const id=recordId('ocrCache',input.entry),before=get('ocrCache',id);if(before&&Date.parse(before.at)>Date.parse(input.entry.at))return {version:getMeta('version',0),entry:before};const result=patch({mutationId:crypto.randomUUID(),changes:[{collection:'ocrCache',id,before,after:input.entry}]});return {version:result.version,entry:input.entry};}
   const items=input.items.filter(i=>get('libraryBooks',i.id));const changes=items.map(i=>{const before=get('libraryBooks',i.id);return {collection:'libraryBooks',id:i.id,before,after:{...before,progress:{...before.progress,...i.progress}}};});const result=patch({mutationId:crypto.randomUUID(),changes});return {version:result.version,items};
  }
  if(type==='search'){const term=String(input.query||'').trim();if(!term)return {results:[]};const args=[],clauses=[];if([...term].length>=3){clauses.push('search_index MATCH ?');args.push('"'+term.replace(/"/g,'""')+'"');}else{clauses.push("(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')");const like='%'+term.replace(/[\\%_]/g,'\\$&')+'%';args.push(like,like);}if(input.bookId){clauses.push('book=?');args.push(input.bookId);}if(input.chapter){clauses.push('chapter=?');args.push(input.chapter);}return {results:q('SELECT collection,id,title,substr(body,1,240) preview,book,chapter FROM search_index WHERE '+clauses.join(' AND ')+' LIMIT 100').all(...args)};}
  if(type==='metrics')return {schema:1,migration:getMeta('migration'),version:getMeta('version',0),records:q('SELECT collection,count(*) count FROM records GROUP BY collection').all(),historyBlobs:q('SELECT count(*) count FROM blobs').get().count,recoveryVersions:q('SELECT count(*) count FROM versions').get().count,pendingChanges:q('SELECT count(*) count FROM outbox').get().count,drafts:q('SELECT count(*) count FROM drafts').get().count,databaseBytes:[database,database+'-wal',database+'-shm'].reduce((n,file)=>n+(fs.existsSync(file)?fs.statSync(file).size:0),0),integrity:q('PRAGMA quick_check').get().quick_check};
  if(type==='export')return exportSnapshot();
  if(type==='restore-envelope'){importSnapshot(input.envelope,input.drafts||{},true);normalizeImported();meta('legacyFileState',legacyState());return {ok:true};}
  if(type==='restore'){importSnapshot(readLegacy(file),draftsFile?readLegacy(draftsFile,'draft'):{},true);normalizeImported();meta('legacyFileState',legacyState());return {ok:true};}
  if(type==='checkpoint'){db.exec('PRAGMA wal_checkpoint(PASSIVE)');return {ok:true};}
  throw Error('不支持的架构存储操作：'+type);
 }
 return {operation,snapshot,patch,close(){db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.close();}};
}
module.exports={createStore,readLegacy,stable,hash,recordId,collections};
