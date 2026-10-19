const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib');
const {readerBudget}=require('../work/mac-app/asar-src/windows-reader-budget.cjs');
const {createModelCache}=require('../work/mac-app/asar-src/windows-ocr-models.cjs');
const {createWindowsData}=require('../work/mac-app/asar-src/windows-data.cjs');
const {load,plain}=require('./load-ts.cjs');
test('8 GB integrated GPU budget, battery prefetch, pressure and 16 GB ceiling',()=>{
 const baseline=readerBudget({totalKB:8*1024*1024,availableKB:3*1024*1024});assert.equal(baseline.canvasPixels,6000000);assert.equal(baseline.cachePixels,12000000);assert(baseline.allowPrefetch);
 const battery=readerBudget({totalKB:8*1024*1024,availableKB:3*1024*1024,onBattery:true});assert(!battery.allowPrefetch);assert.equal(battery.canvasPixels,baseline.canvasPixels);
 const pressure=readerBudget({totalKB:16*1024*1024,availableKB:500000});assert.equal(pressure.canvasPixels,4000000);assert(!pressure.allowPrefetch);assert(pressure.ocrIdleMs<baseline.ocrIdleMs);
 assert(!readerBudget({totalKB:16*1024*1024,availableKB:4*1024*1024,cpuLimit:50}).allowPrefetch);
 assert.equal(readerBudget({totalKB:16*1024*1024,availableKB:4*1024*1024}).canvasPixels,8000000);
});
test('stable native model cache, exact uncompressed model, restart reuse and corrupt cache rebuild',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wenjian-model-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const source=path.join(dir,'shipped'),directory=path.join(dir,'cache');await fs.mkdir(source);const model=Buffer.from('synthetic traineddata '.repeat(300));
 await fs.writeFile(path.join(source,'eng.traineddata.gz'),zlib.gzipSync(model));const cache=createModelCache({source,directory});
 const [one,two]=await Promise.all([cache('eng'),cache('eng')]);assert.equal(one,two);assert.deepEqual(await fs.readFile(one),model);
 const before=await fs.stat(one);assert.equal(await createModelCache({source,directory})('eng'),one);assert.equal((await fs.stat(one)).mtimeMs,before.mtimeMs);
 await fs.writeFile(one,'partial');assert.equal(await createModelCache({source,directory})('eng'),one);assert.deepEqual(await fs.readFile(one),model);
 await assert.rejects(cache('../other'),/Unsupported/);assert.equal((await fs.readdir(directory)).filter(name=>name.endsWith('.traineddata')).length,1);
});
test('draft size cap, replacement saves and read-after-full-restore',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wenjian-draft-cap-')),file=path.join(dir,'drafts.json'),worker=createWindowsData(file,'draft');t.after(async()=>{await worker.close();await fs.rm(dir,{recursive:true,force:true});});
 await worker.call('draft-set',{key:'safe',value:'preserve'});await assert.rejects(worker.call('draft-set',{key:'large',value:'x'.repeat(32*1024*1024)}),/32 MB/);assert.equal((await worker.call('draft-get',{key:'safe'})).value,'preserve');
 await assert.rejects(worker.call('draft-set',{key:'__proto__',value:{text:'invalid'}}),/名称/);
 await worker.call('write',{value:{restored:'a complete backup'}});assert.equal((await worker.call('draft-get',{key:'safe'})).found,false);assert.equal((await worker.call('draft-get',{key:'restored'})).value,'a complete backup');
});
test('worker sync calculations preserve real conflicts, merge and pending local edits',async()=>{
 const core=load('lib/sync/core.ts'),{calculate}=load('lib/sync/compute-tasks.ts'),seed=JSON.parse(await fs.readFile('work/mac-app/seed.json','utf8')).data;
 seed.setupCompleted=true;const base=core.capture(core.newSyncState('fixture-device-a'),seed),remoteBase={...base,device:'fixture-device-b'};
 const left=structuredClone(seed),right=structuredClone(seed);left.notes[0].title='Left';right.notes[0].title='Right';
 const aa=core.capture(base,left),bb=core.capture(remoteBase,right),state={...aa,operations:core.unionOperations(aa.operations,bb.operations)};
 assert.deepEqual(plain(calculate('summary',{state,data:left}).conflicts),plain(core.materialize(state,left).conflicts));assert.equal(calculate('summary',{state:base,data:seed}).changed,true,'pending is not acknowledged');
 const acknowledged={...base,pending:[]};assert(calculate('unchanged',{state:acknowledged,data:seed}));assert(!calculate('unchanged',{state:acknowledged,data:left}));
 const merged=calculate('finish',{state:base,data:seed,remote:[],sent:base.pending.map(op=>op.id),received:['batch'],epoch:'fixture-epoch'});assert.equal(merged.sync.pending.length,0);assert.deepEqual(plain(merged.data),plain(core.materialize(base,seed).data));
});
test('legacy verified receipt skips unchanged originals but rechecks same-size changes',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wenjian-receipt-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const storageDir=path.join(dir,'old'),userDataDir=path.join(dir,'local');await fs.mkdir(path.join(storageDir,'library'),{recursive:true});await fs.mkdir(userDataDir);
 const source=path.join(storageDir,'library','one.pdf');await fs.writeFile(source,'original');const options={storageDir,userDataDir,storageMode:'nutstore',cacheVerified:true,books:[{id:'one',storedFile:'one.pdf'}]},prepare=require('../work/mac-app/asar-src/library-location').prepareLocalLibrary;
 await prepare(options);assert(await fs.stat(path.join(userDataDir,'verified-legacy-library.json')));await prepare(options);await fs.writeFile(source,'modified');await assert.rejects(prepare(options),/内容不同/);assert.equal(await fs.readFile(path.join(userDataDir,'library','one.pdf'),'utf8'),'original');
});
