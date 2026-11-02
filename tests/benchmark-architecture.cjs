// Fictional data only. This measures storage CPU/I/O, not human input latency.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {createStore}=require('../work/mac-app/asar-src/architecture-store.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'wenjian-architecture-bench-')),file=path.join(root,'notebook.json'),draftsFile=path.join(root,'drafts.json'),out=path.resolve('outputs/architecture-validation');fs.mkdirSync(out,{recursive:true});let store;
try{
 const seed=JSON.parse(fs.readFileSync('tests/fixtures/reading-board/notebook.json'));seed.data.ocrCache=[];
 for(let page=1;page<=400;page++)seed.data.ocrCache.push({libraryBookId:'reading-pdf',page,text:('虚构扫描页 '+page+' 语言与世界。').repeat(1600),lines:[{text:'合成性能资料',x0:0,y0:0,x1:1,y1:1}],at:'2026-11-01T00:00:00Z'});
 for(let i=0;i<1000;i++)seed.data.libraryHighlights.push({id:'h-'+i,libraryBookId:'reading-pdf',quote:'合成摘录 '+i,sourceLocation:'pdf:'+((i%400)+1),locator:'合成页',at:'2026-11-01T00:00:00Z'});
 const operations=seed.data.ocrCache.map((value,i)=>({id:'op-'+i,key:'ocrCache/'+i,value,parents:[],at:'2026-11-01T00:00:00Z',device:'synthetic'}));seed.sync={schema:1,operations,pending:[],observed:Object.fromEntries(operations.map(op=>[op.key,op.value]))};
 const legacy=JSON.stringify(seed),legacyBytes=Buffer.byteLength(legacy);fs.writeFileSync(file,legacy);fs.writeFileSync(draftsFile,JSON.stringify({paper:{text:'未提交草稿🙂'}}));
 const importStart=performance.now();store=createStore({file,draftsFile});const migrationMs=performance.now()-importStart;
 const before=seed.data.libraryHighlights[0],after={...before,color:'purple'},request={mutationId:'benchmark-first',changes:[{collection:'libraryHighlights',id:before.id,before,after}]},requestBytes=Buffer.byteLength(JSON.stringify(request));
 const durations=[];let current=after;store.patch(request);
 for(let i=0;i<60;i++){const next={...current,color:i%2?'purple':'green'},start=performance.now();store.patch({mutationId:'benchmark-'+i,changes:[{collection:'libraryHighlights',id:current.id,before:current,after:next}]});durations.push(performance.now()-start);current=next;}
 const snapshotStart=performance.now(),snapshot=store.operation('snapshot'),snapshotMs=performance.now()-snapshotStart;assert.equal(snapshot.data.ocrCache.length,0);assert.equal(fs.readFileSync(file,'utf8'),legacy,'interactive edits never rewrite the old JSON');
 store.operation('checkpoint');const sorted=[...durations].sort((a,b)=>a-b),metrics=store.operation('metrics'),report={fictional:true,scope:'Node SQLite storage benchmark; not an end-to-end UI benchmark',legacyStoreMiB:legacyBytes/1048576,oldNotebookPayloadMiB:Buffer.byteLength(JSON.stringify({data:seed.data}))/1048576,newRecordRequestBytes:requestBytes,migrationMs,lightSnapshotBytes:Buffer.byteLength(JSON.stringify(snapshot)),lightSnapshotMs:snapshotMs,recordTransactions:{count:durations.length,p50Ms:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1)},databaseMiB:metrics.databaseBytes/1048576,integrity:metrics.integrity};
 fs.writeFileSync(path.join(out,'storage-benchmark.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{store?.close();fs.rmSync(root,{recursive:true,force:true});}
