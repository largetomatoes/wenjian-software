'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createStore}=require('../work/mac-app/asar-src/architecture-store.cjs');
const {protectUpdateData}=require('../work/mac-app/asar-src/update-safeguard.cjs');
test('update safeguards live SQLite edits and drafts even when JSON is stale',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wenjian-live-update-'));let store;t.after(async()=>{store?.close();await fs.rm(dir,{recursive:true,force:true});});const file=path.join(dir,'notebook.json'),draftsFile=path.join(dir,'drafts.json');
 await fs.writeFile(file,JSON.stringify({version:1,data:{notes:[{id:'q',title:'旧内容'}]},sync:{schema:1,pending:[],operations:[]}}));await fs.writeFile(draftsFile,'{}');store=createStore({file,draftsFile});
 const current=store.snapshot();current.version++;current.data.notes[0].title='更新前最新的文字😀';store.operation('write',{value:current});store.operation('draft-set',{key:'paper',value:{text:'还未提交的草稿'}});
 assert.equal(JSON.parse(await fs.readFile(file)).data.notes[0].title,'旧内容');
 const folder=await protectUpdateData({directory:dir,checkpoint:async()=>store.operation('checkpoint'),exportRecords:async()=>store.operation('export'),readNotebook:async()=>store.snapshot(),readDrafts:async()=>store.operation('draft-read'),validate:d=>Array.isArray(d.notes)});
 assert.equal(JSON.parse(await fs.readFile(path.join(folder,'notebook.json'))).data.notes[0].title,'更新前最新的文字😀');assert.equal(JSON.parse(await fs.readFile(path.join(folder,'drafts.json'))).paper.text,'还未提交的草稿');assert.equal(JSON.parse(await fs.readFile(file)).data.notes[0].title,'更新前最新的文字😀');
});
test('failed checkpoint prevents update protection from claiming success',async()=>{await assert.rejects(protectUpdateData({checkpoint:async()=>{throw Error('disk failure');}}),/disk failure/);});
