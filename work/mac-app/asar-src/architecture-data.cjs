'use strict';
const {Worker}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path');
function createArchitectureData(file,draftsFile){
 const source=fs.readFileSync(path.join(__dirname,'architecture-store.cjs'),'utf8');
 const tail=`
const {parentPort,workerData}=require('node:worker_threads');
 const checks=require(workerData.root+'/notebook-settings.cjs'),model=require(workerData.root+'/notebook-model.cjs');
 require(workerData.root+'/record-migration.cjs').prepareRecordDatabase({...workerData,normalizeNotebook:model.normalize});
 const store=createStore({...workerData,normalizeNotebook:model.normalize,validateTransition:(a,b)=>checks.validateCoreTransition(a,b)||checks.validateReadingTransition(a,b)});
 let queue=Promise.resolve();parentPort.on('message',({id,type,input})=>{queue=queue.catch(()=>{}).then(()=>{const start=performance.now();try{if(type==='close'){store.close();parentPort.postMessage({id,result:{closed:true}});parentPort.close();return;}const result=store.operation(type,input);parentPort.postMessage({id,result,ms:performance.now()-start});}catch(e){parentPort.postMessage({id,error:e.message,status:e.status||500,ms:performance.now()-start});}});});`;
 const worker=new Worker(source+tail,{eval:true,workerData:{file,draftsFile,root:__dirname}}),pending=new Map(),timings=[];let sequence=0,failed,closing=false,closed=false,closeJob;
 const fail=e=>{failed=e;for(const job of pending.values()){clearTimeout(job.timer);job.reject(e);}pending.clear();};
 worker.on('error',fail);worker.on('exit',code=>{closed=true;if(!closing||pending.size)fail(Error('本地资料服务已停止，提交结果需核对，恢复草稿不会覆盖正式记录。'));});
 worker.on('message',m=>{const job=pending.get(m.id);if(!job)return;clearTimeout(job.timer);pending.delete(m.id);timings.push({type:job.type,ms:m.ms});if(timings.length>200)timings.shift();if(m.error){const error=Error(m.error);error.status=m.status;job.reject(error);}else job.resolve(m.result);});
 const call=(type,input={})=>{if(failed||closed||closing&&type!=='close')return Promise.reject(failed||Error('资料服务正在关闭。'));return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);const e=Error('资料服务等待超时，提交结果尚待核对。');e.status=504;reject(e);},30000);pending.set(id,{resolve,reject,type,timer});try{worker.postMessage({id,type,input});}catch(e){clearTimeout(timer);pending.delete(id);reject(e);}});};
 const adapter={call,timings,close(){if(closeJob)return closeJob;closing=true;closeJob=call('close').catch(e=>{closing=false;closeJob=null;throw e;});return closeJob;}};
 return {notebook:adapter,drafts:{call:(type,input)=>call(type==='read'?'draft-read':type==='write'?'draft-write':type,input),close:()=>Promise.resolve()},timings};
}
module.exports={createArchitectureData};
