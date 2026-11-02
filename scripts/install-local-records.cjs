'use strict';
const fs=require('node:fs/promises'),syncFs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {createStore,readLegacy,stable}=require('../work/mac-app/asar-src/architecture-store.cjs');
const {normalize}=require('../work/mac-app/asar-src/notebook-model.cjs');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const plist=app=>JSON.parse(execFileSync('/usr/bin/plutil',['-convert','json','-o','-',path.join(app,'Contents/Info.plist')],{encoding:'utf8'}));
const countData=data=>Object.fromEntries(['notes','cards','crossThoughts','readingNotes','bookThoughts','libraryBooks','libraryHighlights','ocrCache'].map(k=>[k,data[k]?.length||0]));
function running(bundleId){const script='ObjC.import("AppKit"); var rows=$.NSWorkspace.sharedWorkspace.runningApplications; var found=[]; for(var i=0;i<rows.count;i++){var a=rows.objectAtIndex(i);try{if(ObjC.unwrap(a.bundleIdentifier)==='+JSON.stringify(bundleId)+')found.push({pid:Number(a.processIdentifier),path:ObjC.unwrap(a.bundleURL.path)});}catch(e){}} JSON.stringify(found);';return JSON.parse(execFileSync('/usr/bin/osascript',['-l','JavaScript','-e',script],{encoding:'utf8'}));}
async function quit(bundleId){if(!running(bundleId).length)return;execFileSync('/usr/bin/osascript',['-e','tell application id '+JSON.stringify(bundleId)+' to quit'],{timeout:30000});for(let i=0;i<120;i++){if(!running(bundleId).length)return;await sleep(250);}throw Error('正常保存退出尚未完成，未强制退出、未替换应用。');}
function info(port){return new Promise(resolve=>{const request=http.get({host:'127.0.0.1',port,path:'/api/app/info',timeout:1200},response=>{let body='';response.setEncoding('utf8');response.on('data',b=>body+=b);response.on('end',()=>{try{resolve(JSON.parse(body));}catch{resolve(null);}});});request.on('error',()=>resolve(null));request.on('timeout',()=>{request.destroy();resolve(null);});});}
async function health(bundleId,displayBuild){for(let attempt=0;attempt<60;attempt++){for(const app of running(bundleId)){let output='';try{output=execFileSync('/usr/sbin/lsof',['-nP','-a','-p',String(app.pid),'-iTCP','-sTCP:LISTEN','-Fn'],{encoding:'utf8'});}catch{}for(const line of output.split('\n')){const m=/^n127\.0\.0\.1:(\d+)$/.exec(line);if(m){const value=await info(Number(m[1]));if(value?.displayBuild===displayBuild)return value;}}}await sleep(500);}throw Error('替换后应用未通过本地启动检查。');}
async function main(){
 const root=process.cwd(),target='/Applications/问间.app',candidate=path.join(root,'work/mac-app/release/mac/问间-3.141-darwin-arm64/问间.app'),profile=path.join(os.homedir(),'Library/Application Support/问间');
 const asar=await import('../work/mac-app/node_modules/@electron/asar/lib/asar.js'),archive=path.join(candidate,'Contents/Resources/app.asar'),pkg=JSON.parse(asar.extractFile(archive,'package.json').toString('utf8'));
 if(pkg.architectureTrial||!pkg.recordStorage)throw Error('候选包仍是独立试用配置，拒绝替换正式软件。');
 const oldInfo=plist(target),newInfo=plist(candidate);if(oldInfo.CFBundleIdentifier!==newInfo.CFBundleIdentifier||oldInfo.CFBundleVersion!==newInfo.CFBundleVersion)throw Error('正式应用身份或构建号不匹配。');
 const oldMain=asar.extractFile(path.join(target,'Contents/Resources/app.asar'),'main.js');if(digest(oldMain)!=='75848b70b98799bf6d88065059925cfcf80337da21bb50562ed23bcd0fdb1d12')throw Error('当前正式应用已发生其他变化，停止以免覆盖。');
 execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',candidate]);
 // All fictional-window tests must have exited before this point. Normal quit
 // uses the application's own final-input and draft protection protocol.
 await quit('com.wenjian.architecture.preview');await quit(oldInfo.CFBundleIdentifier);
 const config=JSON.parse(await fs.readFile(path.join(profile,'sync-config.json'),'utf8'));if(config.provider!=='local')throw Error('资料库仍为旧目录同步模式，停止自动迁移。');
 const dataDir=config.dataDirectory,dataFile=path.join(dataDir,'notebook.json'),draftFile=path.join(profile,'drafts.json'),database=dataFile+'.sqlite3';if(syncFs.existsSync(database))throw Error('已有另一份数据库，停止以免覆盖。');
 const recovery=path.join(profile,'upgrade-safeguards','record-storage-'+new Date().toISOString().replace(/[:.]/g,'-'));await fs.mkdir(recovery,{recursive:true,mode:0o700});await fs.chmod(recovery,0o700);
 const savedProfile=path.join(recovery,'profile'),savedData=path.join(recovery,'data');await fs.mkdir(savedProfile,{mode:0o700});await fs.mkdir(savedData,{mode:0o700});
 for(const entry of await fs.readdir(profile,{withFileTypes:true}))if(entry.isFile()){await fs.copyFile(path.join(profile,entry.name),path.join(savedProfile,entry.name));await fs.chmod(path.join(savedProfile,entry.name),0o600);}
 for(const name of ['notebook.json','notebook.json.wj-journal','notebook.json.wj-checkpoint'])await fs.copyFile(path.join(dataDir,name),path.join(savedData,name)).catch(e=>{if(e.code!=='ENOENT'||name==='notebook.json')throw e;});
 const legacy=readLegacy(path.join(savedData,'notebook.json')),drafts=readLegacy(path.join(savedProfile,'drafts.json'),'draft'),expected=normalize(legacy.data),originalConfig=await fs.readFile(path.join(profile,'sync-config.json'));
 const bookStats=[];for(const book of legacy.data.libraryBooks||[])if(book.storedFile){const file=path.join(profile,'library',book.storedFile);try{const s=await fs.stat(file);bookStats.push({file,size:s.size,mtime:s.mtimeMs,ino:s.ino});}catch(e){if(e.code!=='ENOENT')throw e;}}
 const store=createStore({file:path.join(savedData,'notebook.json'),draftsFile:path.join(savedProfile,'drafts.json'),normalizeNotebook:normalize});let counts;
 try{const migrated=store.snapshot();if(stable(migrated.data)!==stable(expected)||stable(migrated.sync)!==stable(legacy.sync)||stable(store.operation('draft-read'))!==stable(drafts))throw Error('完整迁移核对未通过，未替换。');counts=countData(migrated.data);}finally{store.close();}
 const sourceDb=path.join(savedData,'notebook.json.sqlite3'),stagedDb=database+'.new-'+crypto.randomUUID(),stagedApp=path.join('/Applications','.问间-待替换-'+crypto.randomUUID()+'.app'),previousApp=path.join(recovery,'问间.app');
 let databasePublished=false,oldMoved=false,installed=false;
 try{
  await fs.copyFile(sourceDb,stagedDb);await fs.chmod(stagedDb,0o600);const handle=await fs.open(stagedDb,'r');try{await handle.sync();}finally{await handle.close();}if(digest(await fs.readFile(stagedDb))!==digest(await fs.readFile(sourceDb)))throw Error('数据库复制核验失败。');
  execFileSync('/usr/bin/ditto',[candidate,stagedApp]);execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',stagedApp]);
  await fs.rename(stagedDb,database);databasePublished=true;await fs.rename(target,previousApp);oldMoved=true;await fs.rename(stagedApp,target);installed=true;
  execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',target]);
  const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(database,{readOnly:true});let integrity;try{integrity=db.prepare('PRAGMA quick_check').get().quick_check;if(integrity!=='ok')throw Error('数据库完整性核对失败。');}finally{db.close();}
  for(const original of bookStats){const s=await fs.stat(original.file);if(s.size!==original.size||s.mtimeMs!==original.mtime||s.ino!==original.ino)throw Error('书籍原件发生变化，需核对后再打开。');}
  if(digest(await fs.readFile(path.join(profile,'sync-config.json')))!==digest(originalConfig))throw Error('同步配置发生变化，需核对。');
  execFileSync('/usr/bin/open',['-a',target]);const opened=await health(newInfo.CFBundleIdentifier,pkg.displayBuild);
  const report={installed:true,application:target,version:opened.version,displayBuild:opened.displayBuild,counts,draftsImportedExactly:true,syncStateImportedExactly:true,syncConnectionUnchanged:true,bookFilesUnchanged:bookStats.length,integrity,recovery};await fs.mkdir('outputs/local-install',{recursive:true});await fs.writeFile('outputs/local-install/installation.json',JSON.stringify(report,null,2));await fs.writeFile(path.join(recovery,'receipt.json'),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));
 }catch(error){
  if(installed){await quit(oldInfo.CFBundleIdentifier);await fs.rename(target,path.join(recovery,'未通过启动检查的新版本.app'));}
  if(oldMoved)await fs.rename(previousApp,target);
  if(databasePublished){for(const suffix of ['','-wal','-shm'])await fs.rename(database+suffix,path.join(recovery,'未启用的数据库'+suffix)).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  if(oldMoved)execFileSync('/usr/bin/open',['-a',target]);throw error;
 }finally{await fs.rm(stagedApp,{recursive:true,force:true});await fs.rm(stagedDb,{force:true});}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
