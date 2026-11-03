const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {recordConfirmedUpdate,pruneConfirmedUpdates,maintainUpdateCache}=require('../work/mac-app/asar-src/update-retention.cjs');
async function fixture(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wenjian-retention-')),cache=path.join(dir,'cache'),target=path.join(dir,'installed','问间.app');await fs.mkdir(cache);await fs.mkdir(path.join(target,'Contents/MacOS'),{recursive:true});await fs.writeFile(path.join(target,'Contents/MacOS/问间'),'protected current app');t.after(()=>fs.rm(dir,{recursive:true,force:true,maxRetries:8,retryDelay:25}));const options=build=>({directory:cache,exePath:path.join(target,'Contents/MacOS/问间'),platform:'darwin',bundleId:'test.wenjian',build,validateApplication:async(folder,oldBuild)=>{try{return JSON.parse(await fs.readFile(path.join(folder,'program.json'))).build===oldBuild}catch{return false;}}});
async function job(build,state='succeeded'){
 const nonce='test-'+build,program=target+'.wenjian-previous-'+nonce,safeguard=path.join(cache,'safeguard-'+build+'-'+nonce),zip=path.join(cache,'update-3.1415-'+build+'.zip'),stage=path.join(cache,'stage-'+nonce);
 await fs.mkdir(program);await fs.writeFile(path.join(program,'program.json'),JSON.stringify({build:build-1}));await fs.mkdir(safeguard);await fs.writeFile(path.join(safeguard,'notebook.json'),'{"keep":"all thoughts"}');await fs.writeFile(path.join(safeguard,'drafts.json'),'{"keep":"all drafts"}');await fs.writeFile(zip,'verified software archive');await fs.mkdir(path.join(stage,'__MACOSX'),{recursive:true});await fs.writeFile(path.join(stage,'__MACOSX','metadata'),'metadata');
 const spec={directory:cache,target,platform:'darwin',bundleId:'test.wenjian',build,previousBuild:build-1,version:'3.1415',nonce,zip,safeguard};await fs.writeFile(path.join(cache,'status.json'),JSON.stringify({state,build,nonce}));await fs.writeFile(path.join(cache,'install-'+nonce+'.json'),JSON.stringify(spec));return {spec,program,safeguard,zip,stage};
}return {dir,cache,target,options,job};}
const exists=file=>fs.stat(file).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e});
test('successful updates retain one previous program/ZIP and three complete data safeguards',async t=>{
 const f=await fixture(t),jobs=[];const unknown=path.join(f.dir,'installed','问间.app.wenjian-previous-unknown');await fs.mkdir(unknown);await fs.writeFile(path.join(f.cache,'update-unknown.zip'),'untracked');
 for(let n=347;n<=351;n++){const j=await f.job(n);jobs.push(j);await recordConfirmedUpdate(f.options(n),j.spec);}
 for(let i=0;i<jobs.length;i++){assert.equal(await exists(jobs[i].program),i===jobs.length-1);assert.equal(await exists(jobs[i].zip),i===jobs.length-1);assert.equal(await exists(jobs[i].safeguard),i>=jobs.length-3);assert.equal(await exists(jobs[i].stage),false);}
 assert(await exists(f.target));assert(await exists(unknown));assert(await exists(path.join(f.cache,'update-unknown.zip')));assert.equal(await fs.readFile(path.join(f.target,'Contents/MacOS/问间'),'utf8'),'protected current app');
});
test('failure, rollback and mismatched confirmation never register or remove artifacts',async t=>{
 const f=await fixture(t),first=await f.job(347);await recordConfirmedUpdate(f.options(347),first.spec);const failed=await f.job(348,'rolledBack');await recordConfirmedUpdate(f.options(348),failed.spec);await maintainUpdateCache(f.options(348));assert(await exists(first.program));assert(await exists(failed.program));const ledger=JSON.parse(await fs.readFile(path.join(f.cache,'confirmed-updates.json')));assert.equal(ledger.entries.length,1);
 await fs.writeFile(path.join(f.cache,'status.json'),JSON.stringify({state:'succeeded',build:348,nonce:'different'}));await recordConfirmedUpdate(f.options(348),failed.spec);assert(await exists(first.program));
});
test('a completed installer can be registered after a crash before maintenance',async t=>{
 const f=await fixture(t),a=await f.job(347);await maintainUpdateCache(f.options(347));const b=await f.job(348);await maintainUpdateCache(f.options(348));assert(!await exists(a.program));assert(await exists(b.program));await maintainUpdateCache(f.options(348));assert(await exists(b.safeguard));
});
test('edited program contents, authored files and symlinks are protected',async t=>{
 const f=await fixture(t),a=await f.job(347);await recordConfirmedUpdate(f.options(347),a.spec);await fs.writeFile(path.join(a.program,'private-thought.md'),'user added this after the update');const b=await f.job(348);await fs.writeFile(path.join(b.program,'notebook.json'),'{"user":"never remove"}');await recordConfirmedUpdate(f.options(348),b.spec);const c=await f.job(349);await recordConfirmedUpdate(f.options(349),c.spec);assert(await exists(a.program));assert(await exists(b.program));assert(await exists(c.program));
 const external=path.join(f.dir,'external');await fs.mkdir(external);await fs.writeFile(path.join(external,'notebook.json'),'protected');const link=await f.job(350);await fs.rm(link.program,{recursive:true});await fs.symlink(external,link.program,'dir');await recordConfirmedUpdate(f.options(350),link.spec);assert(await exists(path.join(external,'notebook.json')));
});
test('modified data safeguards and malformed ledgers cannot be silently purged',async t=>{
 const f=await fixture(t),a=await f.job(347);await recordConfirmedUpdate(f.options(347),a.spec);await fs.writeFile(path.join(a.safeguard,'drafts.json'),'{"new":"user changed this"}');for(let n=348;n<=351;n++){const j=await f.job(n);await recordConfirmedUpdate(f.options(n),j.spec);}assert(await exists(a.safeguard));
 const ledger=path.join(f.cache,'confirmed-updates.json');await fs.writeFile(ledger,'not JSON');await assert.rejects(pruneConfirmedUpdates(f.options(351)));assert.equal(await fs.readFile(ledger,'utf8'),'not JSON');assert(await exists(a.safeguard));
});
test('legacy specs and forged outside paths are not adopted',async t=>{
 const f=await fixture(t),a=await f.job(347),old={...a.spec};delete old.previousBuild;await recordConfirmedUpdate(f.options(347),old);assert(!await exists(path.join(f.cache,'confirmed-updates.json')));
 const outside=path.join(f.dir,'personal');await fs.mkdir(outside);await fs.writeFile(path.join(outside,'note.txt'),'protected');await recordConfirmedUpdate(f.options(347),{...a.spec,target:outside});assert(await exists(path.join(outside,'note.txt')));assert(await exists(a.program));
});

test('macOS default validation prunes only an older correctly signed application', {skip:process.platform!=='darwin'},async t=>{
 const f=await fixture(t),cp=require('node:child_process');
 const first=await f.job(347),second=await f.job(348);
 async function sign(folder,build){await fs.rm(path.join(folder,'program.json'));await fs.mkdir(path.join(folder,'Contents/MacOS'),{recursive:true});const source=path.join(f.dir,'fixture.c');await fs.writeFile(source,'int main(){return 0;}');cp.execFileSync('/usr/bin/clang',[source,'-o',path.join(folder,'Contents/MacOS/Fixture')]);await fs.writeFile(path.join(folder,'Contents/Info.plist'),`<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>test.wenjian</string><key>CFBundleVersion</key><string>${build}</string><key>CFBundleExecutable</key><string>Fixture</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>`);cp.execFileSync('/usr/bin/codesign',['--force','--sign','-',folder],{stdio:'pipe'});}
 await sign(first.program,346);await sign(second.program,347);
 for(const [j,build]of [[first,347],[second,348]]){await fs.writeFile(path.join(f.cache,'status.json'),JSON.stringify({state:'succeeded',nonce:j.spec.nonce,build}));const options=f.options(build);delete options.validateApplication;await recordConfirmedUpdate(options,j.spec);}
 assert(!await exists(first.program));assert(await exists(second.program));cp.execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',second.program]);assert(await exists(f.target));
});
