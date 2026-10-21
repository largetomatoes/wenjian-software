const path=require('node:path'),{spawn}=require('node:child_process');
function programEnvironment(platform=process.platform,source=process.env){
 if(platform!=='win32')return {PATH:'/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin',HOME:source.HOME,LANG:'zh_CN.UTF-8'};
 // Keep Windows runtime discovery, without forwarding account/service secrets.
 const result={};for(const wanted of ['SystemRoot','windir','PATH','PATHEXT','USERPROFILE','TEMP','TMP','APPDATA','LOCALAPPDATA']){const key=Object.keys(source).find(k=>k.toLowerCase()===wanted.toLowerCase());if(key&&source[key])result[wanted]=source[key];}return result;
}
function terminateProgram(child,platform=process.platform,source=process.env,start=spawn){
 if(!Number.isSafeInteger(child?.pid)||child.pid<1)return;
 const fallback=()=>{try{child.kill('SIGKILL');}catch{}};
 if(platform==='win32'){
  const env=programEnvironment(platform,source),root=env.SystemRoot||env.windir||'C:\\Windows';
  try{const task=start(path.win32.join(root,'System32','taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',env});task.on('error',fallback);task.on('exit',code=>{if(code!==0)fallback();});}catch{fallback();}
 }else{try{process.kill(-child.pid,'SIGKILL');}catch{fallback();}}
}
module.exports={programEnvironment,terminateProgram};
