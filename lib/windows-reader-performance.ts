export type ReaderBudget={canvasPixels:number;cachePixels:number;ocrIdleMs:number;allowPrefetch:boolean;onBattery:boolean;cpuLimit:number};
export let readerBudget:ReaderBudget={canvasPixels:6_000_000,cachePixels:12_000_000,ocrIdleMs:180000,allowPrefetch:false,onBattery:false,cpuLimit:100};
export function configurePortableReader(){readerBudget={canvasPixels:3_000_000,cachePixels:6_000_000,ocrIdleMs:60000,allowPrefetch:false,onBattery:true,cpuLimit:100};}
export function installReaderBudget(){
 let running=false;const refresh=async()=>{if(running||document.hidden)return;running=true;try{const response=await fetch('/api/app/reader-budget');if(!response.ok)return;const next=await response.json() as ReaderBudget;if(!Number.isFinite(next.canvasPixels)||!Number.isFinite(next.cachePixels))return;const changed=readerBudget.canvasPixels!==next.canvasPixels||readerBudget.cachePixels!==next.cachePixels;readerBudget=next;if(changed)window.dispatchEvent(new Event('wenjian:reader-budget'));}catch{}finally{running=false;}};
 void refresh();setInterval(()=>void refresh(),30000);document.addEventListener('visibilitychange',()=>void refresh());window.addEventListener('focus',()=>void refresh());
}
import type {Worker as TesseractWorker,LoggerMessage} from 'tesseract.js';
// Windows desktop only. Native Mac/mobile keep their existing rendering policy.
export function isWindowsReader(){return typeof document!=='undefined'&&document.documentElement.dataset.wenjianPlatform==='windows';}
export function windowsCanvasRatio(width:number,height:number,dpr:number){return Math.min(Math.max(.25,dpr||1),Math.sqrt(readerBudget.canvasPixels/Math.max(1,width*height)));}
// The desktop file server supports byte ranges. Read the visible page first,
// rather than retaining an entire large scanned book while OCR is starting.
export const windowsPdfLoadOptions={disableStream:true,disableAutoFetch:true,rangeChunkSize:256*1024};
export class WindowsPreviewCache<T extends {width:number;height:number}> {
 private entries=new Map<string,T>();
 constructor(private pixelBudget=1_800_000,private countLimit=3){}
 get(key:string){const value=this.entries.get(key);if(value){this.entries.delete(key);this.entries.set(key,value);}return value;}
 put(key:string,image:T){
  if(image.width*image.height>this.pixelBudget)return false;
  const old=this.entries.get(key);if(old&&old!==image)old.width=old.height=1;this.entries.delete(key);this.entries.set(key,image);
  const pixels=()=>[...this.entries.values()].reduce((sum,item)=>sum+item.width*item.height,0);
  while(this.entries.size>this.countLimit||pixels()>this.pixelBudget){const first=this.entries.entries().next().value!;this.entries.delete(first[0]);first[1].width=first[1].height=1;}
  return true;
 }
 clear(){for(const image of this.entries.values())image.width=image.height=1;this.entries.clear();}
 get pixels(){return [...this.entries.values()].reduce((sum,image)=>sum+image.width*image.height,0);}
}
export class WindowsPdfPageCache {
 private pages=new Map<number,{pageNumber:number;cleanup:()=>boolean}>();
 track(page:{pageNumber:number;cleanup:()=>boolean}){this.pages.set(page.pageNumber,page);}
 prune(current:number){for(const [number,page] of this.pages)if(Math.abs(number-current)>1&&page.cleanup())this.pages.delete(number);}
 clear(){this.pages.clear();}
}
export async function prepareWindowsEpubFont(doc:Document){
 if(!isWindowsReader()||!doc.head)return;
 if(!doc.getElementById('wenjian-windows-serif')){const style=doc.createElement('style');style.id='wenjian-windows-serif';style.textContent='@font-face{font-family:"Songti SC";src:url('+JSON.stringify(new URL('/fonts/NotoSerifSC-variable.woff2',location.origin).href)+') format("woff2");font-weight:200 900;font-display:swap}';doc.head.appendChild(style);}
 // The content hook runs before epub.js measures pagination. A timeout keeps a
 // missing font from blocking opening; a later font event can still reflow it.
 await Promise.race([doc.fonts.load('400 18px "Songti SC"','中文阅读').catch(()=>{}),new Promise(resolve=>setTimeout(resolve,2500))]);
}
export class WindowsOcrSession {
 private worker:TesseractWorker|null=null;private creating:Promise<TesseractWorker>|null=null;private generation=0;private idle:ReturnType<typeof setTimeout>|null=null;private logger:((message:LoggerMessage)=>void)|null=null;
 async acquire(create:(logger:(message:LoggerMessage)=>void)=>Promise<TesseractWorker>,logger:(message:LoggerMessage)=>void,signal?:AbortSignal):Promise<TesseractWorker>{
  if(signal?.aborted)throw new DOMException('OCR cancelled','AbortError');
  if(this.idle)clearTimeout(this.idle);this.idle=null;this.logger=logger;if(this.worker)return this.worker;
  if(this.creating){try{await this.creating;}catch{}if(signal?.aborted){this.release(this.worker,logger);throw new DOMException('OCR cancelled','AbortError');}return this.acquire(create,logger,signal);}
  if(!this.creating){const generation=this.generation;const pending=create(message=>this.logger?.(message)).then(async worker=>{if(generation!==this.generation){await worker.terminate().catch(()=>{});throw new DOMException('OCR cancelled','AbortError');}this.worker=worker;return worker;}).finally(()=>{if(this.creating===pending)this.creating=null;});this.creating=pending;}
  const worker=await this.creating;if(signal?.aborted){this.release(worker,logger);throw new DOMException('OCR cancelled','AbortError');}return worker;
 }
 release(worker:TesseractWorker|null,logger?:((message:LoggerMessage)=>void)|null){if(!worker||worker!==this.worker||(logger&&this.logger!==logger))return;this.logger=null;if(this.idle)clearTimeout(this.idle);this.idle=setTimeout(()=>this.dispose(),readerBudget.ocrIdleMs);}
 dispose(){this.generation++;this.logger=null;if(this.idle)clearTimeout(this.idle);this.idle=null;const worker=this.worker;this.worker=null;if(worker)void worker.terminate().catch(()=>{});}
}
export class WindowsPixelProcessor {
 private worker:Worker|null=null;private job:{reject:(error:Error)=>void;cleanup:()=>void}|null=null;
 async prepare(context:CanvasRenderingContext2D,width:number,height:number,signal:AbortSignal){
  if(signal.aborted)throw new DOMException('OCR cancelled','AbortError');
  let bitmap:ImageBitmap|undefined,pixels:ImageData|undefined;
  if(typeof createImageBitmap==='function'&&typeof OffscreenCanvas!=='undefined'){try{bitmap=await createImageBitmap(context.canvas);}catch{/* Older graphics drivers use the established fallback. */}}
  if(signal.aborted){bitmap?.close();throw new DOMException('OCR cancelled','AbortError');}
  if(!bitmap)pixels=context.getImageData(0,0,width,height);
  const output=await new Promise<ArrayBuffer>((resolve,reject)=>{
   const cleanup=()=>signal.removeEventListener('abort',cancel);const cancel=()=>this.cancel();this.job={reject,cleanup};signal.addEventListener('abort',cancel,{once:true});
   try{this.worker=new Worker(new URL('./windows-ocr-pixels.worker.ts',import.meta.url),{type:'module'});this.worker.onmessage=event=>{cleanup();this.worker?.terminate();this.worker=null;this.job=null;resolve(event.data);};this.worker.onerror=()=>{cleanup();this.worker?.terminate();this.worker=null;this.job=null;reject(Error('后台图像预处理失败，请重新识别。'));};if(bitmap)this.worker.postMessage({bitmap,width,height},[bitmap]);else this.worker.postMessage({pixels:pixels!.data.buffer,width,height},[pixels!.data.buffer]);}catch(error){bitmap?.close();cleanup();this.worker?.terminate();this.worker=null;this.job=null;reject(error);}
  });
  if(signal.aborted)throw new DOMException('OCR cancelled','AbortError');return new Uint8Array(output);
 }
 cancel(){this.worker?.terminate();this.worker=null;const job=this.job;this.job=null;if(job){job.cleanup();job.reject(new DOMException('OCR cancelled','AbortError'));}}
}

export const sharedWindowsOcr=new WindowsOcrSession();
