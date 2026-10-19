const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

// This preference belongs to the device, never to the synced notebook.
function createPerformanceSettings({directory,app}){
 const file=path.join(directory,'windows-performance.json');
 let enabled=false,warning='';
 try{const saved=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));if(typeof saved.hardwareAcceleration!=='boolean')throw Error('Invalid graphics preference');enabled=saved.hardwareAcceleration;}
 catch(error){if(error.code!=='ENOENT')warning='图形设置未能读取，已使用默认关闭状态。可以重新保存设置。';}
 const active=enabled;
 if(!active)app.disableHardwareAcceleration();
 const status=()=>({hardwareAcceleration:enabled,active,restartRequired:enabled!==active,warning});
 function save(value){
  if(typeof value!=='boolean')throw Error('图形加速设置无效。');
  fs.mkdirSync(directory,{recursive:true});
  const temporary=file+'.new-'+crypto.randomUUID();let fd;
  try{fd=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({hardwareAcceleration:value})+'\n','utf8');fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temporary,file);enabled=value;warning='';}
  finally{if(fd!==undefined)fs.closeSync(fd);try{fs.unlinkSync(temporary);}catch{}}
  return status();
 }
 return {status,save};
}
module.exports={createPerformanceSettings};
