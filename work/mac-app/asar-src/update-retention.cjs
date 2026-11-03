'use strict';
// Only artifacts recorded after a confirmed successful update are eligible.
// Never discover user files by a broad recursive/glob-based cleanup.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),execFile=require('node:util').promisify(require('node:child_process').execFile);
const ledgerName='confirmed-updates.json',noncePattern=/^[a-zA-Z0-9-]{1,100}$/;
function targetFor(o){return o.platform==='darwin'?path.resolve(path.dirname(o.exePath),'../..'):path.dirname(o.exePath);}
async function stamp(file,kind){try{const s=await fs.lstat(file,{bigint:true});if(s.isSymbolicLink()||!(kind==='dir'?s.isDirectory():s.isFile()))return null;return [s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].map(String).join(':');}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function sameArtifact(a,kind){return !!a&&typeof a.path==='string'&&typeof a.stamp==='string'&&await stamp(a.path,kind)===a.stamp;}
async function readLedger(directory){try{const value=JSON.parse(await fs.readFile(path.join(directory,ledgerName),'utf8'));if(value.schema!==1||!Array.isArray(value.entries))throw Error('更新整理清单格式不正确，未清理任何文件。');return value;}catch(e){if(e.code==='ENOENT')return {schema:1,entries:[]};throw e;}}
async function writeLedger(directory,value){const tmp=path.join(directory,ledgerName+'.new'),h=await fs.open(tmp,'w',0o600);try{await h.writeFile(JSON.stringify(value));await h.sync();}finally{await h.close();}await fs.rename(tmp,path.join(directory,ledgerName));}
async function validateApplication(o,folder,build){
 if(o.validateApplication)return o.validateApplication(folder,build);
 try{
  if(o.platform==='darwin'){
   const info=JSON.parse((await execFile('/usr/bin/plutil',['-convert','json','-o','-',path.join(folder,'Contents/Info.plist')],{encoding:'utf8'})).stdout);
   if(info.CFBundleIdentifier!==o.bundleId||Number(info.CFBundleVersion)!==build)return false;
   await execFile('/usr/bin/codesign',['--verify','--deep','--strict',folder]);return true;
  }
  // Electron's fs understands the packaged ASAR path. No external extraction.
  const p=JSON.parse(await fs.readFile(path.join(folder,'resources/app.asar/package.json'),'utf8'));
  const h=await fs.open(path.join(folder,'Wenjian.exe'),'r');try{const b=Buffer.alloc(2);await h.read(b,0,2,0);return b.toString()==='MZ'&&p.name==='wenjian'&&Number(p.buildVersion)===build;}finally{await h.close();}
 }catch{return false;}
}
async function hasAuthoredFiles(folder){
 let count=0;const pending=[folder];while(pending.length){const current=pending.pop();for(const entry of await fs.readdir(current,{withFileTypes:true})){
  if(++count>20000)return true;
  if(entry.isSymbolicLink())continue;
  if(entry.isDirectory())pending.push(path.join(current,entry.name));
  else if(/^(notebook|drafts)\.json(?:\.|$)/i.test(entry.name)||/\.(sqlite3?|db|wenjian-backup|pdf|epub)$/i.test(entry.name))return true;
 }}return false;
}
async function treeStamp(folder){
 const hash=crypto.createHash('sha256'),pending=[folder];let count=0;
 while(pending.length){const current=pending.pop(),entries=(await fs.readdir(current,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));for(const entry of entries){
  if(++count>20000)throw Error('程序副本目录过大，暂不自动整理。');const file=path.join(current,entry.name),s=await fs.lstat(file,{bigint:true});
  hash.update(JSON.stringify([path.relative(folder,file),...['dev','ino','size','mtimeNs','ctimeNs'].map(k=>String(s[k]))]));if(entry.isDirectory()&&!entry.isSymbolicLink())pending.push(file);
 }}return hash.digest('hex');
}
function validEntry(o,e){const target=targetFor(o),directory=path.resolve(o.directory);return e&&typeof e.nonce==='string'&&noncePattern.test(e.nonce)&&e.platform===o.platform&&e.bundleId===o.bundleId&&e.target===target&&Number.isSafeInteger(e.build)&&e.build<=o.build&&Number.isSafeInteger(e.previousBuild)&&e.previousBuild>0&&e.previousBuild<e.build&&
 (!e.program||e.program.path===target+'.wenjian-previous-'+e.nonce)&&(!e.download||e.download.path===path.join(directory,`update-${e.version}-${e.build}.zip`))&&/^3\.[0-9]{1,50}$/.test(e.version)&&
 (!e.safeguard||path.dirname(e.safeguard.path)===directory&&/^safeguard-\d+-[a-zA-Z0-9-]+$/.test(path.basename(e.safeguard.path)));}
async function safeSafeguard(a){
 if(!await sameArtifact(a,'dir'))return false;const names=(await fs.readdir(a.path)).sort();if(names.join('|')!=='drafts.json|notebook.json')return false;
 for(const name of names)if(!a.files?.[name]||await stamp(path.join(a.path,name),'file')!==a.files[name])return false;
 return true;
}
async function contextSafe(o){return ['darwin','win32'].includes(o.platform)&&typeof o.exePath==='string'&&typeof o.directory==='string'&&path.isAbsolute(o.exePath)&&path.isAbsolute(o.directory)&&!!await stamp(path.resolve(o.directory),'dir');}
async function prune(o,ledger){
 const result={removed:[],skipped:[]},candidates=ledger.entries.filter(e=>validEntry(o,e)).sort((a,b)=>b.build-a.build);
 for(const [key,keep,kind]of [['program',1,'dir'],['download',1,'file'],['safeguard',3,'dir']]){
  let retained=0;
  for(const e of candidates){const a=e[key];if(!a)continue;
   try{
    let safe=await sameArtifact(a,kind);
    if(safe&&key==='program')safe=typeof a.treeStamp==='string'&&await treeStamp(a.path)===a.treeStamp&&await validateApplication(o,a.path,e.previousBuild)&&!await hasAuthoredFiles(a.path);
    if(safe&&key==='safeguard')safe=await safeSafeguard(a);
    if(!safe){if(await fs.lstat(a.path).catch(()=>null))result.skipped.push(a.path);continue;}
    if(retained++<keep)continue;
    // No current target, profile root, unknown directory, or unrecorded artifact.
    await fs.rm(a.path,{recursive:kind==='dir',force:false});result.removed.push(a.path);delete e[key];
   }catch{result.skipped.push(a.path);}
  }
 }
 // Successful installers move the application out of stage; only metadata may remain.
 for(const e of candidates){const folder=path.join(path.resolve(o.directory),'stage-'+e.nonce);try{
  if(!await stamp(folder,'dir'))continue;
  const names=await fs.readdir(folder);if(names.some(n=>n!=='__MACOSX')||await hasAuthoredFiles(folder))continue;
  await fs.rm(folder,{recursive:true});result.removed.push(folder);
 }catch{result.skipped.push(folder);}}
 ledger.entries=ledger.entries.filter(e=>!validEntry(o,e)||e.program||e.download||e.safeguard||e.build===o.build);
 await writeLedger(path.resolve(o.directory),ledger);return result;
}
async function pruneConfirmedUpdates(o){if(!await contextSafe(o))return {removed:[],skipped:[]};return prune(o,await readLedger(o.directory));}
async function recordConfirmedUpdate(o,spec){
 if(!await contextSafe(o)||!spec||spec.directory!==path.resolve(o.directory)||spec.target!==targetFor(o)||spec.build!==o.build||spec.platform!==o.platform||spec.bundleId!==o.bundleId||(typeof spec.nonce!=='string'||!noncePattern.test(spec.nonce))||!Number.isSafeInteger(spec.previousBuild)||spec.previousBuild<1||spec.previousBuild>=spec.build)return {removed:[],skipped:[]};
 const status=JSON.parse((await fs.readFile(path.join(o.directory,'status.json'),'utf8')).replace(/^\uFEFF/,''));if(status.state!=='succeeded'||status.build!==spec.build||status.nonce!==spec.nonce)return {removed:[],skipped:[]};
 const ledger=await readLedger(o.directory);if(ledger.entries.some(e=>e.nonce===spec.nonce))return prune(o,ledger);
 const e={nonce:spec.nonce,build:spec.build,previousBuild:spec.previousBuild,version:spec.version,platform:spec.platform,bundleId:spec.bundleId,target:spec.target,confirmedAt:new Date().toISOString()};
 if(!validEntry(o,e))return {removed:[],skipped:[]};
 const program=spec.target+'.wenjian-previous-'+spec.nonce,programStamp=await stamp(program,'dir');if(programStamp&&await validateApplication(o,program,spec.previousBuild))e.program={path:program,stamp:programStamp,treeStamp:await treeStamp(program)};
 const download=path.join(o.directory,`update-${spec.version}-${spec.build}.zip`);if(spec.zip===download){const s=await stamp(download,'file');if(s)e.download={path:download,stamp:s};}
 if(typeof spec.safeguard==='string'&&path.dirname(spec.safeguard)===o.directory&&/^safeguard-\d+-[a-zA-Z0-9-]+$/.test(path.basename(spec.safeguard))){
  const s=await stamp(spec.safeguard,'dir'),files={};if(s){for(const name of ['notebook.json','drafts.json'])files[name]=await stamp(path.join(spec.safeguard,name),'file');const a={path:spec.safeguard,stamp:s,files};if(await safeSafeguard(a))e.safeguard=a;}
 }
 ledger.entries.push(e);await writeLedger(o.directory,ledger);return prune(o,ledger);
}
async function maintainUpdateCache(o){
 if(!await contextSafe(o))return {removed:[],skipped:[]};
 let status;try{status=JSON.parse((await fs.readFile(path.join(o.directory,'status.json'),'utf8')).replace(/^\uFEFF/,''));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(status&&['installing','verifying','failed','rolledBack'].includes(status.state))return {removed:[],skipped:[]};
 if(status?.state==='succeeded'&&status.build===o.build&&typeof status.nonce==='string'&&noncePattern.test(status.nonce)){
  try{const spec=JSON.parse(await fs.readFile(path.join(o.directory,'install-'+status.nonce+'.json'),'utf8'));return recordConfirmedUpdate(o,spec);}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 return pruneConfirmedUpdates(o);
}
module.exports={recordConfirmedUpdate,pruneConfirmedUpdates,maintainUpdateCache};
