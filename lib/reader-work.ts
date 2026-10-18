// Cooperate with Windows reading without changing OCR models or recognition policy.
export class ReaderWork {
 private lastActivity=-Infinity;
 private rendering=0;
 private lastRenderEnd=-Infinity;
 constructor(private now=()=>performance.now()){}
 activity(){this.lastActivity=this.now();}
 beginRender(){this.rendering++;let released=false;return()=>{if(!released){released=true;this.rendering--;if(this.rendering===0)this.lastRenderEnd=this.now();}};}
 busy(quietMs=650,includeRendering=true){return includeRendering&&this.rendering>0||this.now()-Math.max(this.lastActivity,includeRendering?this.lastRenderEnd:-Infinity)<quietMs;}
 wait(signal?:AbortSignal,quietMs=650,includeRendering=true):Promise<void>{
  return new Promise((resolve,reject)=>{let timer:ReturnType<typeof setTimeout>;const clean=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};const abort=()=>{clean();reject(new DOMException('Reading work cancelled','AbortError'));};const check=()=>{if(signal?.aborted){abort();return;}if(!this.busy(quietMs,includeRendering)){clean();resolve();return;}timer=setTimeout(check,60);};signal?.addEventListener('abort',abort,{once:true});check();});
 }
}
export const readerWork=new ReaderWork();
const windows=()=>typeof document!=='undefined'&&document.documentElement?.dataset?.wenjianPlatform==='windows';
export const readerIsBusy=()=>windows()&&readerWork.busy();
export const waitForReaderIdle=(signal?:AbortSignal,quietMs=650,includeRendering=true)=>windows()?readerWork.wait(signal,quietMs,includeRendering):Promise.resolve();
export function yieldReaderPaint(signal:AbortSignal){
 return new Promise<void>((resolve,reject)=>{let first=0,second=0;const clean=()=>{clearTimeout(timer);cancelAnimationFrame(first);cancelAnimationFrame(second);signal.removeEventListener('abort',abort);};const abort=()=>{clean();reject(new DOMException('Reading work cancelled','AbortError'));};const finish=()=>{clean();if(signal.aborted)reject(new DOMException('Reading work cancelled','AbortError'));else resolve();};const timer=setTimeout(finish,60);signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}first=requestAnimationFrame(()=>{second=requestAnimationFrame(finish);});});
}
export function beginReaderRender(){if(!windows())return()=>{};const release=readerWork.beginRender();return()=>{release();setTimeout(()=>window.dispatchEvent(new Event('wenjian:reader-idle')),700);};}
export function installReaderWorkScheduling(){
 let timer:ReturnType<typeof setTimeout>;const activity=(event:Event)=>{const element=event.target instanceof Element?event.target:event.target instanceof Node?event.target.parentElement:null;if(!element?.closest('.reader-workspace,.book-thoughts-sheet,.book-search-panel'))return;readerWork.activity();window.dispatchEvent(new Event('wenjian:reader-active'));clearTimeout(timer);timer=setTimeout(()=>window.dispatchEvent(new Event('wenjian:reader-idle')),700);};
 for(const type of ['wheel','scroll','pointerdown','keydown'])document.addEventListener(type,activity,{passive:true,capture:true});
}
