import {epubHref,type EpubPage,type EpubPageIndex} from './epub-navigation';
import {waitForReaderIdle} from './reader-work';
import {prepareWindowsEpubFont} from './windows-reader-performance';
const aborted=(signal:AbortSignal)=>{if(signal.aborted)throw new DOMException('Pagination cancelled','AbortError');};
const yieldTask=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
// Layout a single invisible section at a time, using the same epub.js engine,
// styles and dimensions as the visible reader. No second whole-book instance.
export async function paginateEpub({book,rendition,width,height,key,signal,onProgress}:{book:any;rendition:any;width:number;height:number;key:string;signal:AbortSignal;onProgress:(done:number,total:number)=>void}):Promise<EpubPageIndex>{
 const host=document.createElement('div');host.setAttribute('aria-hidden','true');host.setAttribute('inert','');host.style.cssText=`position:fixed;left:-100000px;top:0;width:${width}px;height:${height}px;overflow:hidden;visibility:hidden;pointer-events:none;contain:strict`;document.body.appendChild(host);
 const hidden=new rendition.constructor(book,{width,height,flow:'paginated',spread:rendition.settings.spread||'auto',minSpreadWidth:rendition.settings.minSpreadWidth,resizeOnOrientationChange:false});
 const sections=book.spine.spineItems.filter((section:any)=>section.linear!=='no'),pages:EpubPage[]=[],originalPages:NonNullable<EpubPageIndex['originalPages']>=[];
 let markers:{href:string;label:string}[]=(book.pageList?.pageList||[]).filter((p:any)=>Number.isFinite(p.page)).map((p:any)=>({href:p.href,label:String(p.page)}));
 const stop=()=>{try{hidden.destroy();}catch{}host.remove();};signal.addEventListener('abort',stop,{once:true});
 try{
  await hidden.attachTo(host);aborted(signal);hidden.themes.default(rendition.themes._themes.default.rules);hidden.hooks.content.register((contents:any)=>prepareWindowsEpubFont(contents.document));
  if(book.packaging?.navPath)try{const nav=await book.load(book.packaging.navPath,'xml') as Document,element=Array.from(nav.querySelectorAll('nav')).find(n=>(n.getAttributeNS('http://www.idpf.org/2007/ops','type')||n.getAttribute('epub:type')||'').split(/\s+/).includes('page-list'));if(element)markers=Array.from(element.querySelectorAll('a[href]')).map(a=>({href:a.getAttribute('href')!,label:a.textContent?.trim()||''})).filter(a=>a.label);}catch{/* A missing page-list never blocks ordinary reading pagination. */}
  for(let index=0;index<sections.length;index++){
   await waitForReaderIdle(signal,180,true);aborted(signal);const section=sections[index];await hidden.display(section.href);aborted(signal);
   const view=hidden.manager.views.all()[0],contents=view?.contents;if(!contents)throw Error('章节未能排版，请重新计算页码。');
   for(const marker of markers){const href=epubHref(marker.href),target=epubHref(section.href);if(href!==target&&!href.endsWith('/'+target)&&!target.endsWith('/'+href))continue;const fragment=marker.href.split('#')[1],element=fragment?contents.document.getElementById(decodeURIComponent(fragment)):contents.document.body;if(!element)continue;const range=contents.document.createRange();range.selectNodeContents(element);range.collapse(true);originalPages.push({cfi:contents.cfiFromRange(range),label:marker.label});}
   await Promise.race([contents.document.fonts?.ready||Promise.resolve(),new Promise(resolve=>setTimeout(resolve,1500))]);
   await Promise.race([Promise.all(Array.from(contents.document.images as HTMLCollectionOf<HTMLImageElement>).map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});}))),new Promise(resolve=>setTimeout(resolve,1500))]);aborted(signal);view.expand?.();await yieldTask();aborted(signal);
   const pageWidth=hidden.manager.layout.pageWidth||hidden.manager.layout.width,total=hidden.manager.layout.name==='pre-paginated'?1:Math.max(1,Math.round(view.width()/pageWidth));
   for(let page=0;page<total;page++){
    await waitForReaderIdle(signal,120,false);aborted(signal);
    const start=pageWidth*page,end=pageWidth*(page+1),mapped=hidden.manager.mapping.page(contents,section.cfiBase,start,end);if(!mapped?.start)throw Error('此章节尚无法生成可靠的跳页位置。');if(!pages.length||book.spine.epubcfi.compare(pages[pages.length-1].cfi,mapped.start)<0)pages.push({cfi:mapped.start,section:section.index,page:page+1});
    if(pages.length>30000)throw Error('书籍分页过多，仍可使用目录和逐页阅读。');await yieldTask();
   }
   onProgress(index+1,sections.length);
  }
  originalPages.sort((a,b)=>book.spine.epubcfi.compare(a.cfi,b.cfi));return {schema:1,key,pages,originalPages};
 }finally{signal.removeEventListener('abort',stop);stop();}
}
