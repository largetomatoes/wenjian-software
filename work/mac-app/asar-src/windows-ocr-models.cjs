const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises'),{createGunzip}=require('node:zlib');
// A stable native cache survives random loopback ports; no IndexedDB copy per launch.
function createModelCache({source,directory}){
 const pending=new Map();
 return function model(language){
  if(!['chi_sim','eng'].includes(language))return Promise.reject(Error('Unsupported OCR language'));
  if(pending.has(language))return pending.get(language);
  const task=(async()=>{
   const original=path.join(source,language+'.traineddata.gz'),stat=await fsp.stat(original);
   const key=crypto.createHash('sha256').update([original,stat.size,stat.mtimeMs].join(':')).digest('hex').slice(0,24);
   await fsp.mkdir(directory,{recursive:true,mode:0o700});
   const target=path.join(directory,language+'-'+key+'.traineddata'),receipt=target+'.json';
   try{const saved=JSON.parse(await fsp.readFile(receipt,'utf8')),current=await fsp.stat(target);if(current.size===saved.size&&current.size>0&&current.mtimeMs===saved.mtimeMs)return target;}catch{}
   const temp=target+'.new-'+crypto.randomUUID();
   try{await pipeline(fs.createReadStream(original),createGunzip(),fs.createWriteStream(temp,{flags:'wx',mode:0o600}));
    const handle=await fsp.open(temp,'r+');try{await handle.sync();}finally{await handle.close();}
    await fsp.rename(temp,target);const current=await fsp.stat(target);
    await fsp.writeFile(receipt,JSON.stringify({size:current.size,mtimeMs:current.mtimeMs}),{mode:0o600});
    return target;
   }finally{await fsp.unlink(temp).catch(()=>{});}
  })();pending.set(language,task);task.catch(()=>pending.delete(language));return task;
 };
}
module.exports={createModelCache};
