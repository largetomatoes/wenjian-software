import {flushDraftWrites} from './draft-storage';
async function run(recoveryOnly:boolean){const jobs:Promise<unknown>[]=[];window.dispatchEvent(new CustomEvent('wenjian:flush-drafts',{detail:{jobs,recoveryOnly}}));await Promise.all(jobs);await flushDraftWrites();}
export async function flushEditors(){
 let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([run(false),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('正式保存尚未确认。')),12000);})]);}catch(error){
  // A confirmed durable recovery is independent of a failed formal commit.
  await run(true);
  if(!window.confirm('正式保存尚未完成，但当前恢复草稿已保存在本机。是否保留草稿并离开？下次可继续恢复。'))throw error;
 }finally{clearTimeout(timer);}
}
