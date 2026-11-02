import {isSyncRunning} from './sync/client';
import {flushEditors} from './flush-editors';
export function installWindowsCloseProtocol(){
 let preparing:Promise<boolean>|null=null;
 (window as unknown as {__wenjianPrepareClose:()=>Promise<boolean>}).__wenjianPrepareClose=()=>{
  if(preparing)return preparing;
  preparing=(async()=>{if(isSyncRunning())throw Error('同步尚未结束，请等待完成后再退出。');
   const previous=document.body.inert;document.body.inert=true;
   try{await flushEditors();return true;}finally{document.body.inert=previous;}
  })().finally(()=>{preparing=null;});return preparing;
 };
}
