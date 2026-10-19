import type {Calculation,Input,Output} from './compute';
let worker:Worker|null=null,sequence=0,idle:ReturnType<typeof setTimeout>;
const pending=new Map<number,{resolve:(value:unknown)=>void;reject:(error:Error)=>void}>();
function reset(){clearTimeout(idle);worker?.terminate();worker=null;}
function release(){if(!pending.size)idle=setTimeout(reset,60000);}
export function backgroundCompute<K extends Calculation>(task:K,input:Input<K>):Promise<Output<K>>{
 clearTimeout(idle);
 if(!worker){
  worker=new Worker(new URL('./compute.worker.ts',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{const request=pending.get(data.id);if(!request)return;pending.delete(data.id);if(data.error)request.reject(Error(data.error));else request.resolve(data.result);release();};
  worker.onerror=()=>{for(const request of pending.values())request.reject(Error('后台同步计算中断，本机资料已保留，请重试。'));pending.clear();reset();};
 }
 return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve:value=>resolve(value as Output<K>),reject});try{worker!.postMessage({id,task,input});}catch(error){pending.delete(id);release();reject(error);}});
}
