const fs=require('node:fs/promises'),path=require('node:path'),cp=require('node:child_process');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const exists=async p=>fs.stat(p).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
async function infoFor(bundle){return JSON.parse(cp.execFileSync('/usr/bin/plutil',['-convert','json','-o','-',path.join(bundle,'Contents/Info.plist')],{encoding:'utf8'}));}
function verify(bundle){cp.execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',bundle]);}
(async()=>{
 const config=path.resolve(process.argv[2]),spec=JSON.parse(await fs.readFile(config,'utf8'));
 if(spec.platform!=='darwin'||path.dirname(config)!==spec.directory||path.extname(spec.target)!=='.app'||path.dirname(spec.zip)!==spec.directory||!Number.isInteger(spec.pid)||typeof spec.nonce!=='string'||!/^[-a-zA-Z0-9]+$/.test(spec.nonce))throw Error('Invalid installer specification');
 const backup=spec.target+'.wenjian-previous-'+spec.nonce,failed=spec.target+'.wenjian-failed-'+spec.nonce,stage=path.join(spec.directory,'stage-'+spec.nonce);let moved=false,newPid=null;
 const finish=async(state,error)=>{const dest=path.join(spec.directory,'status.json'),tmp=dest+'.helper-new';await fs.writeFile(tmp,JSON.stringify({state,error,version:spec.version}),{mode:0o600});await fs.rename(tmp,dest);};
 try{
  for(let i=0;i<300;i++){let alive=true;try{process.kill(spec.pid,0);}catch{alive=false;}if(!alive)break;if(i===299)throw Error('Application is still running');await wait(200);}
  if(await exists(backup)||await exists(failed)||await exists(stage))throw Error('Recovery path already exists; no files changed');
  await fs.mkdir(stage,{recursive:true});cp.execFileSync('/usr/bin/ditto',['-x','-k',spec.zip,stage]);
  const source=path.join(stage,'问间.app'),info=await infoFor(source);
  if(info.CFBundleIdentifier!==spec.bundleId||Number(info.CFBundleVersion)!==spec.build)throw Error('Application identity or build mismatch');verify(source);
  await fs.rename(spec.target,backup);moved=true;await fs.rename(source,spec.target);
  const executable=path.join(spec.target,'Contents/MacOS',info.CFBundleExecutable),child=cp.spawn(executable,[],{detached:true,stdio:'ignore',env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}});child.unref();newPid=child.pid;
  let confirmed=false;for(let i=0;i<300;i++){try{const result=JSON.parse(await fs.readFile(spec.confirmation,'utf8'));if(result.nonce===spec.nonce&&result.build===spec.build){confirmed=true;break;}}catch{}await wait(200);}
  if(!confirmed)throw Error('New application did not confirm a valid startup');
  const current=await infoFor(spec.target);if(current.CFBundleIdentifier!==spec.bundleId||Number(current.CFBundleVersion)!==spec.build)throw Error('Installed application changed during verification');verify(spec.target);
  // Never recursively delete an app bundle from the update helper. Keep the previous
  // complete version for recovery, even if cleanup or a later crash is interrupted.
  await finish('succeeded');
 }catch(error){
  let restored=false;
  if(moved){
   if(newPid)try{process.kill(newPid,'SIGTERM');}catch{}
   await wait(500);
   try{
    const old=await infoFor(backup);if(old.CFBundleIdentifier!==spec.bundleId)throw Error('Previous application identity mismatch');verify(backup);
    if(await exists(spec.target))await fs.rename(spec.target,failed);
    await fs.rename(backup,spec.target);restored=true;
    cp.spawn('/usr/bin/open',['-a',spec.target],{detached:true,stdio:'ignore'}).unref();
   }catch(restoreError){error=Error(error.message+'; recovery preserved but not restored: '+restoreError.message);}
  }
  await finish(restored?'rolledBack':'failed',error.message);
 }
})().catch(()=>{});
