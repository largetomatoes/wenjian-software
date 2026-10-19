// Windows small durable transactions. Runs off the Electron main thread.
// Complete exports remain ordinary notebook.json / drafts.json files.
const {parentPort,workerData}=require('node:worker_threads');
const fs=require('node:fs/promises'),crypto=require('node:crypto'),path=require('node:path');
const file=workerData.path,journal=file+'.wj-journal',kind=workerData.kind;
let value=null,signature='',header=null,sequence=0,bytes=0,checkpointTimer=null,draftBytes=3;
const draftSizes=new Map(),MAX_DRAFT_BYTES=32*1024*1024;
const draftSize=(key,item)=>Buffer.byteLength(JSON.stringify(key)+':'+JSON.stringify(item))+1;
function indexDrafts(){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('草稿文件格式不正确。');draftSizes.clear();draftBytes=3;for(const [key,item] of Object.entries(value)){const size=draftSize(key,item);draftSizes.set(key,size);draftBytes+=size;}if(draftBytes>MAX_DRAFT_BYTES)throw Error('草稿超过 32 MB，请先整理后再保存。');}
const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
const statKey=s=>s?[s.size,s.mtimeMs,s.ctimeMs,s.ino].join(':'):'missing';
async function stat(){return fs.stat(file).catch(e=>{if(e.code==='ENOENT'&&kind==='draft')return null;throw e;});}
const parse=b=>JSON.parse(b.toString('utf8').replace(/^\uFEFF/,''));
async function atomic(target,text,backup=false){
 const temp=target+'.new-'+crypto.randomUUID(),old=target+'.backup.new-'+crypto.randomUUID();
 try{if(backup){await fs.copyFile(target,old).catch(e=>{if(e.code!=='ENOENT')throw e;});await fs.rename(old,target+'.backup').catch(e=>{if(e.code!=='ENOENT')throw e;});}
 const h=await fs.open(temp,'wx',0o600);try{await h.writeFile(text,'utf8');await h.sync();}finally{await h.close();}await fs.rename(temp,target);
 }finally{await fs.unlink(temp).catch(()=>{});await fs.unlink(old).catch(()=>{});}
}
function apply(op){
 if(kind==='draft'){draftBytes-=draftSizes.get(op.key)||0;if(op.value===null){delete value[op.key];draftSizes.delete(op.key);}else{Object.defineProperty(value,op.key,{value:op.value,enumerable:true,writable:true,configurable:true});const size=draftSize(op.key,op.value);draftSizes.set(op.key,size);draftBytes+=size;}return;}
 if(op.baseVersion!==value.version)throw Error('阅读日志与资料版本不一致，已保留文件，请先恢复资料。');
 if(op.kind==='progress'){const byId=new Map(op.items.map(b=>[b.id,b.progress]));value={...value,data:{...value.data,libraryBooks:value.data.libraryBooks.map(b=>byId.has(b.id)?{...b,progress:{...b.progress,...byId.get(b.id)}}:b)},version:op.version};}
 else if(op.kind==='ocr'){const entry=op.entry;value={...value,data:{...value.data,ocrCache:[...(value.data.ocrCache||[]).filter(e=>!(e.libraryBookId===entry.libraryBookId&&e.page===entry.page)),entry]},version:op.version};}
 else throw Error('未知阅读日志，未修改资料。');
}
async function load(){
 const next=await stat(),key=statKey(next);if(value&&signature===key)return;
 const raw=next?await fs.readFile(file):Buffer.from('{}');value=parse(raw);if(kind==='draft')indexDrafts();signature=key;header=null;sequence=0;bytes=0;
 if(kind==='notebook'&&(!Number.isInteger(value.version)||!value.data||!Array.isArray(value.data.notes)))throw Error('本地资料格式不正确');
 const log=await fs.readFile(journal).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(!log)return;
 const end=log.lastIndexOf(10);if(end<0)throw Error('阅读日志头不完整，已保留文件。');
 const lines=log.subarray(0,end).toString('utf8').split('\n');header=parse(lines.shift());
 if(header.schema!==1||header.kind!==kind||typeof header.id!=='string')throw Error('阅读日志格式不正确');
 const ops=lines.filter(Boolean).map(line=>{const record=parse(line);if(typeof record.payload!=='string'||digest(record.payload)!==record.sha256)throw Error('阅读日志校验失败，原文件已保留。');return parse(record.payload);});
 for(let i=0;i<ops.length;i++)if(ops[i].sequence!==i+1)throw Error('阅读日志顺序不完整');
 if(digest(raw)!==header.baseHash){
  const marker=kind==='notebook'?value._windowsCheckpoint:null;
  // A completed checkpoint may survive a crash before its old journal is removed.
  if(marker?.id===header.id&&marker.sequence===ops.length){await fs.unlink(journal);header=null;return;}
  // Draft snapshots have an external receipt because draft keys belong to users.
  const receipt=kind==='draft'?await fs.readFile(file+'.wj-checkpoint').then(parse).catch(()=>null):null;
  if(receipt?.id===header.id&&receipt.sequence===ops.length&&receipt.sha256===digest(raw)){await fs.unlink(journal);header=null;return;}
  throw Error('资料文件在阅读日志之外发生变化，已保留两份内容，未自动覆盖。');
 }
 for(const op of ops)apply(op);sequence=ops.length;bytes=log.length;
 if(end+1<log.length)await fs.truncate(journal,end+1); // only an incomplete final unacknowledged append
 scheduleCheckpoint();
}
async function ensureJournal(){if(header)return;const raw=await fs.readFile(file).catch(e=>{if(e.code==='ENOENT'&&kind==='draft')return Buffer.from('{}');throw e;});header={schema:1,kind,id:crypto.randomUUID(),baseHash:digest(raw)};await atomic(journal,JSON.stringify(header)+'\n');sequence=0;bytes=0;}
function scheduleCheckpoint(){clearTimeout(checkpointTimer);if(!header)return;checkpointTimer=setTimeout(()=>{queue=queue.then(checkpoint).catch(error=>{value=null;signature='';parentPort.postMessage({event:'checkpoint-error',error:error.message});});},60000);}
async function append(op){await load();await ensureJournal();op.sequence=sequence+1;const payload=JSON.stringify(op),line=JSON.stringify({payload,sha256:digest(payload)})+'\n';const h=await fs.open(journal,'a',0o600);try{await h.writeFile(line,'utf8');await h.sync();}finally{await h.close();}apply(op);sequence++;bytes+=Buffer.byteLength(line);scheduleCheckpoint();if(bytes>4*1024*1024)await checkpoint();}
async function checkpoint(){
 clearTimeout(checkpointTimer);checkpointTimer=null;await load();if(!header)return;
 const id=header.id;if(kind==='notebook')value={...value,_windowsCheckpoint:{id,sequence}};
 const text=JSON.stringify(value)+'\n';
 // Receipt is durable before snapshot publication; its hash prevents false recovery.
 if(kind==='draft')await atomic(file+'.wj-checkpoint',JSON.stringify({id,sequence,sha256:digest(text)}));
 await atomic(file,text,true);signature=statKey(await stat());await fs.unlink(journal);header=null;sequence=0;bytes=0;
}
async function operation(type,input){await load();
 if(type==='read')return value;
 if(type==='revision')return {version:value.version,syncRevision:value.syncRevision||0};
 if(type==='checkpoint'){await checkpoint();return {ok:true};}
 if(type==='draft-get')return {value:Object.hasOwn(value,input.key)?value[input.key]:null,found:Object.hasOwn(value,input.key)};
 if(type==='draft-set'){if(input.value===undefined)throw Error('草稿内容缺失');if(typeof input.key!=='string'||!input.key||['__proto__','constructor','prototype'].includes(input.key))throw Error('草稿名称不正确。');if(draftBytes-(draftSizes.get(input.key)||0)+(input.value===null?0:draftSize(input.key,input.value))>MAX_DRAFT_BYTES)throw Error('草稿超过 32 MB，请先整理后再保存。');await append({key:input.key,value:input.value});return {saved:true};}
 if(type==='books')return value.data.libraryBooks.map(({id,storedFile,format,cloudFile})=>({id,storedFile,format,cloudFile}));
 if(type==='write'){
  await checkpoint();value=input.value;if(kind==='draft')indexDrafts();await atomic(file,JSON.stringify(value)+'\n',true);signature=statKey(await stat());return {ok:true};
 }
 if(input.version!==value.version)return {conflict:true,version:value.version};
 if(type==='progress'){
  const ids=new Set(value.data.libraryBooks.map(b=>b.id));const items=input.items.filter(b=>ids.has(b.id));if(!items.length)return {version:value.version,items:[]};
  const next=value.version+1;await append({kind:'progress',baseVersion:value.version,version:next,items});return {version:next,items};
 }
 if(type==='ocr'){
  if(!value.data.libraryBooks.some(b=>b.id===input.entry.libraryBookId&&b.format==='pdf'))return {missing:true};
  const previous=value.data.ocrCache?.find(e=>e.libraryBookId===input.entry.libraryBookId&&e.page===input.entry.page);
  if(previous&&Date.parse(previous.at)>Date.parse(input.entry.at))return {version:value.version,entry:previous};
  const next=value.version+1;await append({kind:'ocr',baseVersion:value.version,version:next,entry:input.entry});return {version:next,entry:input.entry};
 }
 throw Error('不支持的本地事务');
}
let queue=Promise.resolve();parentPort.on('message',({id,type,input})=>{queue=queue.then(async()=>{try{parentPort.postMessage({id,result:await operation(type,input||{})});}catch(error){value=null;signature='';parentPort.postMessage({id,error:error.message});}});});
