const {Worker}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path');
function createWindowsData(file,kind='notebook'){
 const worker=new Worker(fs.readFileSync(path.join(__dirname,'windows-data-worker.cjs'),'utf8'),{eval:true,workerData:{path:file,kind}}),pending=new Map();let next=0,failed=null;
 const fail=error=>{failed=error;for(const job of pending.values())job.reject(error);pending.clear();};
 worker.on('error',fail);worker.on('exit',code=>{if(code!==0)fail(Error('本地资料服务意外停止，原文件和阅读日志已保留。'));});
 worker.on('message',message=>{if(message.event){console.error('Local checkpoint deferred:',message.error);return;}const job=pending.get(message.id);if(!job)return;pending.delete(message.id);message.error?job.reject(Error(message.error)):job.resolve(message.result);});
 return {call(type,input={}){if(failed)return Promise.reject(failed);return new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});worker.postMessage({id,type,input});});},async close(){await this.call('checkpoint');await worker.terminate();}};
}
module.exports={createWindowsData};
