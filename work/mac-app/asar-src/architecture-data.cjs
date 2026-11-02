'use strict';
const {Worker}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path');
function createArchitectureData(file,draftsFile){
 const source=fs.readFileSync(path.join(__dirname,'architecture-store.cjs'),'utf8');
 const tail=`\nconst {parentPort,workerData}=require('node:worker_threads');
 const checks=require(workerData.root+'/notebook-settings.cjs');
 const model=require(workerData.root+'/notebook-model.cjs');
 require(workerData.root+'/record-migration.cjs').prepareRecordDatabase({...workerData,normalizeNotebook:model.normalize});
 const store=createStore({...workerData,normalizeNotebook:model.normalize,validateTransition:(a,b)=>checks.validateCoreTransition(a,b)||checks.validateReadingTransition(a,b)});
 let queue=Promise.resolve();parentPort.on('message',({id,type,input})=>{queue=queue.then(()=>{const start=performance.now();try{const result=store.operation(type,input);parentPort.postMessage({id,result,ms:performance.now()-start});}catch(e){parentPort.postMessage({id,error:e.message,status:e.status||500,ms:performance.now()-start});}});});`;
 const worker=new Worker(source+tail,{eval:true,workerData:{file,draftsFile,root:__dirname}}),pending=new Map(),timings=[];let sequence=0,failed;
 const fail=e=>{failed=e;for(const job of pending.values())job.reject(e);pending.clear();};worker.on('error',fail);worker.on('exit',code=>{if(code)fail(Error('本地资料服务已停止，已提交的记录仍在独立数据库内。'));});
 worker.on('message',m=>{const job=pending.get(m.id);if(!job)return;pending.delete(m.id);timings.push({type:job.type,ms:m.ms});if(timings.length>200)timings.shift();if(m.error){const error=Error(m.error);error.status=m.status;job.reject(error);}else job.resolve(m.result);});
 const adapter={call(type,input={}){if(failed)return Promise.reject(failed);return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject,type});worker.postMessage({id,type,input});});},timings,async close(){await adapter.call('checkpoint');await worker.terminate();}};
 return {notebook:adapter,drafts:{call:(type,input)=>adapter.call(type==='read'?'draft-read':type==='write'?'draft-write':type,input),close:()=>Promise.resolve()},timings};
}
module.exports={createArchitectureData};
