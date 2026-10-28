// Tesseract termination does not settle pending jobs. Cancellation must release
// ownership independently, and old jobs must never release a newer job's lock.
export class OcrTaskController {
 private current: {key:string;controller:AbortController}|null=null;
 get busy(){return this.current!==null;}
 start(key:string){
  if(this.current)return null;
  const task={key,controller:new AbortController()};this.current=task;
  return {signal:task.controller.signal,isCurrent:()=>this.current===task,
   finish:()=>{if(this.current===task)this.current=null;}};
 }
 cancel(){const task=this.current;this.current=null;task?.controller.abort();return task?.key;}
}
export function waitForOcr<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{
  const cancelled=()=>{cleanup();reject(new DOMException('OCR cancelled','AbortError'));};
  const cleanup=()=>signal.removeEventListener('abort',cancelled);
  promise.then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
  if(signal.aborted)cancelled();else signal.addEventListener('abort',cancelled,{once:true});
 });
}

// One expensive OCR engine per app window. A waiting pane can be cancelled
// without interrupting the other pane's active recognition.
export class SharedOcrSlot {
 private active=false;
 private queue:Array<{signal:AbortSignal;resolve:(release:()=>void)=>void;reject:(error:Error)=>void;abort:()=>void}>=[];
 acquire(signal:AbortSignal):Promise<()=>void>{
  return new Promise((resolve,reject)=>{
   if(signal.aborted){reject(new DOMException('OCR cancelled','AbortError'));return;}
   const entry={signal,resolve,reject,abort:()=>{this.queue=this.queue.filter(item=>item!==entry);reject(new DOMException('OCR cancelled','AbortError'));}};
   signal.addEventListener('abort',entry.abort,{once:true});this.queue.push(entry);this.next();
  });
 }
 private next(){
  if(this.active)return;
  while(this.queue.length){const entry=this.queue.shift()!;entry.signal.removeEventListener('abort',entry.abort);if(entry.signal.aborted){entry.reject(new DOMException('OCR cancelled','AbortError'));continue;}
   this.active=true;let released=false;entry.resolve(()=>{if(released)return;released=true;this.active=false;this.next();});return;
  }
 }
}
export const sharedReaderOcrSlot=new SharedOcrSlot();
