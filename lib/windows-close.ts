import {isSyncRunning} from './sync/client';
import {flushDraftWrites} from './draft-storage';
// Real exit only; hiding in the tray keeps the window and its state alive.
export function installWindowsCloseProtocol(){
 (window as unknown as {__wenjianPrepareClose:()=>Promise<boolean>}).__wenjianPrepareClose=async()=>{
  if(isSyncRunning())throw Error('同步尚未结束，请稍后退出，或先收起到托盘。');
  const previous=document.body.inert;document.body.inert=true;let timeout:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([(async()=>{const jobs:Promise<unknown>[]=[];window.dispatchEvent(new CustomEvent('wenjian:flush-drafts',{detail:{jobs}}));await Promise.all(jobs);await new Promise(resolve=>setTimeout(resolve,600));await flushDraftWrites();})(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('保存等待超时，请返回检查。')),5500);})]);return true;}finally{clearTimeout(timeout);document.body.inert=previous;}
 };
}
