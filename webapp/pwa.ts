export type WebAppState={offline:boolean;ready:boolean;update:ServiceWorker|null;error:string;checking:boolean;checkMessage:string};
let state:WebAppState={offline:!navigator.onLine,ready:false,update:null,error:'',checking:false,checkMessage:''};
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(fn=>fn());
export const subscribeWebState=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export const getWebState=()=>state;
export function installPwa(){
 document.documentElement.dataset.wenjianWeb='true';
 for(const type of ['online','offline'])window.addEventListener(type,()=>{state={...state,offline:!navigator.onLine};emit();});
 if(!('serviceWorker' in navigator)){state={...state,error:'当前浏览器不支持离线应用，请使用更新版本的 Safari。'};emit();return;}
 let registering=false;
 const register=async()=>{if(registering)return;registering=true;try{const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});state={...state,ready:!!registration.active,update:registration.waiting};emit();registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){state={...state,ready:true,update:navigator.serviceWorker.controller?worker:null,error:'',checkMessage:navigator.serviceWorker.controller?'更新已准备好，请保存后更新。':'离线应用已准备好。'};emit();}});});}catch{state={...state,error:'离线资源暂未准备完成，请联网后重新打开。'};emit();}finally{registering=false;}};
 window.addEventListener('load',()=>void register(),{once:true});
 if(document.readyState==='complete')void register();
}
// Web apps update their own service worker; they do not install a desktop/APK package.
export async function checkWebUpdate(){
 if(state.checking)return;
 state={...state,checking:true,error:'',checkMessage:''};emit();let timeout:ReturnType<typeof setTimeout>|undefined;
 try{
  if(!navigator.onLine)throw Error('当前离线，请联网后检查更新。');
  if(!('serviceWorker' in navigator))throw Error('当前浏览器不支持离线更新，请使用 Safari 打开。');
  const registration=await navigator.serviceWorker.getRegistration('/');
  if(!registration)throw Error('离线应用正在准备，请稍后再检查。');
  await Promise.race([registration.update(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('检查更新超时，当前版本和本机资料仍保留。')),12000);})]);
  state={...state,update:registration.waiting||state.update,checkMessage:registration.waiting?'更新已准备好，请保存后更新。':registration.installing?'正在准备新版离线资源…':state.update?'更新已准备好，请保存后更新。':'当前已是最新 Web App。'};
 }catch(error){state={...state,error:error instanceof Error?error.message:'暂时无法检查更新，请稍后重试。'};}
 finally{clearTimeout(timeout);state={...state,checking:false};emit();}
}
export async function applyWebUpdate(){const update=state.update;if(!update)return;try{const prepare=(window as unknown as {__wenjianPrepareClose?:()=>Promise<boolean>}).__wenjianPrepareClose;if(prepare&&await prepare()===false)throw Error('草稿尚未保存，请完成保存后更新。');let requested=false;const reload=()=>{if(requested)return;requested=true;location.reload();};navigator.serviceWorker.addEventListener('controllerchange',reload,{once:true});update.postMessage({type:'ACTIVATE_UPDATE'});}catch(error){state={...state,error:error instanceof Error?error.message:'保存尚未完成，暂未更新。'};emit();}}
