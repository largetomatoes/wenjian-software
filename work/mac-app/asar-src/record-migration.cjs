'use strict';
// First launch after any supported legacy version: preserve the original files,
// validate a private staged database, then publish it. Never migrate in-place.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createStore,readLegacy,stable,hash}=require('./architecture-store.cjs');
function prepareRecordDatabase({file,draftsFile,normalizeNotebook,validateTransition=()=>'',fault=()=>{}}){
 const database=file+'.sqlite3';
 if(fs.existsSync(database))return {existing:true};
 const folder=path.join(path.dirname(file),'record-migration-safeguards',new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID());
 fs.mkdirSync(folder,{recursive:true,mode:0o700});
 for(const [source,name]of [[file,'notebook.json'],[draftsFile,'drafts.json']])if(source){
  for(const suffix of ['', '.wj-journal','.wj-checkpoint']){
   try{const bytes=fs.readFileSync(source+suffix);fs.writeFileSync(path.join(folder,name+suffix),bytes,{mode:0o600,flag:'wx'});}
   catch(error){if(error.code!=='ENOENT'||source===file&&!suffix)throw error;}
  }
 }
 const savedFile=path.join(folder,'notebook.json'),savedDrafts=path.join(folder,'drafts.json');
 const before=readLegacy(savedFile),drafts=readLegacy(savedDrafts,'draft');
 const stage=path.join(folder,'verified.sqlite3');let store;
 try{
  fault('before-import');
  store=createStore({file:savedFile,draftsFile:savedDrafts,database:stage,normalizeNotebook,validateTransition,legacyGuardFile:file,legacyGuardDrafts:draftsFile});
  const actual=store.snapshot(),expected={...before,data:normalizeNotebook?normalizeNotebook(before.data):before.data};
  // Normalization may advance the local version once; all envelope fields,
  // sync history, original words and keyed drafts must still match exactly.
  if(stable({...actual,version:before.version})!==stable(expected)||stable(store.operation('draft-read'))!==stable(drafts)||store.operation('metrics').integrity!=='ok')throw Error('新资料库核对未通过，原笔记和草稿已保留。');
  store.close();store=null;
  fault('before-publish');
  // Concurrent source changes must never be silently omitted from migration.
  if(stable(readLegacy(file))!==stable(before)||draftsFile&&stable(readLegacy(draftsFile,'draft'))!==stable(drafts))throw Error('迁移期间原资料发生变化，请重新打开问间；原文件未修改。');
  if(fs.existsSync(database))throw Error('已有另一份资料库，已停止自动迁移。');
  const fd=fs.openSync(stage,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.chmodSync(stage,0o600);fs.renameSync(stage,database);
  fs.writeFileSync(path.join(folder,'receipt.json'),JSON.stringify({schema:1,at:new Date().toISOString(),notebookHash:hash(expected),draftHash:hash(drafts),database:'notebook.json.sqlite3',integrity:'ok'}),{mode:0o600});
  return {existing:false,recovery:folder};
 }catch(error){if(store)store.close();throw error;}
}
module.exports={prepareRecordDatabase};
