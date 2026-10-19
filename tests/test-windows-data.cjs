const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{Worker}=require('node:worker_threads');
const {createWindowsData}=require('../work/mac-app/asar-src/windows-data.cjs');
(async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'wenjian-data-')),file=path.join(root,'notebook.json'),draft=path.join(root,'drafts.json');let active=[];
const seed={version:1,data:{notes:[{id:'world',title:'Synthetic'}],libraryBooks:[{id:'book',format:'pdf',storedFile:'sample.pdf',progress:{page:1}}],ocrCache:[]},sync:{pending:[],operations:[]},localTrash:[{id:'keep'}]};
function open(file,kind){const instance=createWindowsData(file,kind);active.push(instance);return instance;}
async function crash(file,kind,fn){const code=await fs.readFile(path.resolve('work/mac-app/asar-src/windows-data-worker.cjs'),'utf8'),worker=new Worker(code,{eval:true,workerData:{path:file,kind:kind||'notebook'}});let id=0;const wait=new Map();worker.on('message',r=>{const task=wait.get(r.id);if(task){wait.delete(r.id);r.error?task.reject(Error(r.error)):task.resolve(r.result);}});const call=(type,input={})=>new Promise((resolve,reject)=>{const n=++id;wait.set(n,{resolve,reject});worker.postMessage({id:n,type,input});});try{await fn(call);}finally{await worker.terminate();}}
try{
 await fs.writeFile(file,JSON.stringify(seed));
 await crash(file,null,async call=>{const r=await call('progress',{version:1,items:[{id:'book',progress:{page:3}}]});assert.equal(r.version,2);assert.equal(JSON.parse(await fs.readFile(file)).version,1,'small progress does not rewrite whole snapshot');});
 let store=open(file);let got=await store.call('read');assert.equal(got.data.libraryBooks[0].progress.page,3);assert.equal(got.version,2);assert.deepEqual(got.localTrash,seed.localTrash);
 assert.equal((await store.call('progress',{version:1,items:[]})).conflict,true,'stale writes rejected');
 const entry={libraryBookId:'book',page:3,at:'2026-10-18T00:00:00Z',version:1,text:'合成文字',lines:[]};
 const delta=await store.call('ocr',{version:2,entry});assert.equal(delta.entry.text,'合成文字');assert(!('data'in delta),'OCR returns delta only');
 const log=await fs.readFile(file+'.wj-journal');await store.call('checkpoint');assert.equal(JSON.parse(await fs.readFile(file)).version,3);
 // Crash after the durable snapshot but before removing its journal.
 await fs.writeFile(file+'.wj-journal',log);await store.close();active=active.filter(s=>s!==store);store=open(file);assert.equal((await store.call('read')).version,3);await assert.rejects(fs.stat(file+'.wj-journal'),{code:'ENOENT'});
 await store.close();active=active.filter(s=>s!==store);
 await crash(file,null,async call=>{await call('progress',{version:3,items:[{id:'book',progress:{page:4}}]});});
 await fs.appendFile(file+'.wj-journal','{"payload":"partial');store=open(file);assert.equal((await store.call('read')).version,4,'partial unacknowledged tail discarded, acknowledged entries recovered');await store.close();active=active.filter(s=>s!==store);
 await crash(file,null,async call=>{await call('progress',{version:4,items:[{id:'book',progress:{page:5}}]});});
 const backup=await fs.readFile(file);await fs.writeFile(file,JSON.stringify({...JSON.parse(backup),externalChange:true}));store=open(file);await assert.rejects(store.call('read'),/之外发生变化/);await fs.writeFile(file,backup);assert.equal((await store.call('read')).version,5);await store.close();active=active.filter(s=>s!==store);
 await crash(draft,'draft',async call=>{await call('draft-set',{key:'reader',value:{text:'未提交草稿'}});});let ds=open(draft,'draft');assert.equal((await ds.call('draft-get',{key:'reader'})).value.text,'未提交草稿');assert.equal((await ds.call('draft-get',{key:'absent'})).found,false);await ds.call('draft-set',{key:'reader',value:null});await ds.close();active=active.filter(s=>s!==ds);assert.deepEqual(JSON.parse(await fs.readFile(draft)),{});
 console.log('PASS: durable delta writes, crash recovery, checkpoint recovery, partial append recovery, external-change protection, version conflict, preserved history and keyed drafts.');
}finally{for(const s of active)await s.close().catch(()=>{});await fs.rm(root,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
