export type EpubTocItem={id:string;href:string;label:string;children:EpubTocItem[]};
export type EpubPage={cfi:string;section:number;page:number};
export type EpubPageIndex={schema:1;key:string;pages:EpubPage[];originalPages?:{cfi:string;label:string}[]};
const navigationRequests=new WeakMap<object,number>();
export function cancelEpubNavigation(rendition:any){if(rendition)navigationRequests.set(rendition,(navigationRequests.get(rendition)||0)+1);}
export async function displayEpub(rendition:any,target?:string){
 if(!rendition)return;
 cancelEpubNavigation(rendition);const request=navigationRequests.get(rendition);
 await rendition.display(target);
 const contents=rendition.getContents?.()||[];
 await Promise.race([Promise.all(contents.map((c:any)=>c.document?.fonts?.ready||Promise.resolve())),new Promise(resolve=>setTimeout(resolve,2500))]);
 await new Promise(resolve=>setTimeout(resolve,60));
 if(navigationRequests.get(rendition)!==request||!rendition.book||!target)return;
 // A new iframe can first position with fallback fonts. Re-anchor after its
 // final font metrics and column widths have settled, preserving the source CFI.
 for(const view of rendition.manager?.views?.all?.()||[])view.expand?.();
 await new Promise(resolve=>setTimeout(resolve,20));
 if(navigationRequests.get(rendition)===request&&rendition.book)await rendition.display(target);
}
export const EPUB_THEME={'body':{'font-family':'"Songti SC","STSong",serif','font-size':'18px','line-height':'2','color':'#314451','padding':'20px 34px'},'::selection':{'background':'#cadde8'}};
export function epubHref(value:string){return decodeURI(value.split('#')[0]).replace(/^\.\//,'').replace(/^OEBPS\//,'');}
export function epubToc(items:any[],prefix=''):EpubTocItem[]{return (items||[]).map((item,index)=>({id:prefix+index,href:item.href||'',label:String(item.label||'未命名章节').trim(),children:epubToc(item.subitems||item.children||[],prefix+index+'.')}));}
export function flattenToc(items:EpubTocItem[]):EpubTocItem[]{return items.flatMap(item=>[item,...flattenToc(item.children)]);}
export function epubChapterLabel(book:any,contents:any,cfi:string):string{
 const href=epubHref(contents?.section?.href||book.spine.get(cfi)?.href||''),doc=contents?.document as Document|undefined;
 const matching=flattenToc(epubToc(book.navigation?.toc)).filter(item=>{const target=epubHref(item.href);return !!target&&(target===href||href.endsWith('/'+target)||target.endsWith('/'+href));});
 let best=matching.find(item=>!item.href.includes('#'))?.label||'';
 if(doc&&contents.cfiFromRange)for(const item of matching){const fragment=item.href.split('#')[1];if(!fragment)continue;const element=doc.getElementById(decodeURIComponent(fragment));if(!element)continue;const range=doc.createRange();range.selectNodeContents(element);range.collapse(true);try{if(book.spine.epubcfi.compare(contents.cfiFromRange(range),cfi)<=0)best=item.label;}catch{}}
 if(best)return best;
 if(doc){try{const selected=contents.range(cfi),anchor=selected.startContainer.nodeType===1?selected.startContainer:selected.startContainer.parentElement;let heading='';for(const element of Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6')))if(element===anchor||element.contains(anchor)||(element.compareDocumentPosition(anchor)&4))heading=element.textContent?.trim()||heading;if(heading)return heading;}catch{}return doc.querySelector('h1,h2,title')?.textContent?.trim()||matching[0]?.label||'当前章节';}
 return matching[0]?.label||'当前章节';
}
export function pageAtCfi(pages:EpubPage[],cfi:string,compare:(a:string,b:string)=>number){let low=0,high=pages.length-1,found=0;while(low<=high){const mid=(low+high)>>1;if(compare(pages[mid].cfi,cfi)<=0){found=mid;low=mid+1;}else high=mid-1;}return found+1;}
export function pageTarget(pages:EpubPage[],requested:number){if(!Number.isInteger(requested)||requested<1||requested>pages.length)throw Error(`请输入 1 至 ${pages.length} 之间的页码。`);return pages[requested-1].cfi;}
export function originalPageAt(pages:EpubPageIndex['originalPages'],cfi:string,compare:(a:string,b:string)=>number){if(!pages?.length||compare(cfi,pages[0].cfi)<0)return '';let low=0,high=pages.length-1,found=0;while(low<=high){const mid=(low+high)>>1;if(compare(pages[mid].cfi,cfi)<=0){found=mid;low=mid+1;}else high=mid-1;}return pages[found].label;}
export function epubIndexKey(book:any,width:number,height:number,identity:string){
 const platform=typeof navigator==='undefined'?'test':navigator.platform+':'+document.documentElement.dataset.wenjianMobile+':'+document.documentElement.dataset.wenjianWeb;
 const zip=book.archive?.zip?.files||{},files=Object.values(zip).map((f:any)=>[f.name,f._data?.crc32,f._data?.uncompressedSize].join(':')).join('|'),text=[platform,identity,Math.round(width),Math.round(height),JSON.stringify(EPUB_THEME),files,book.packaging?.metadata?.modified||'',book.spine.spineItems.map((s:any)=>s.href).join('|')].join(':');let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return 'v2-'+(hash>>>0).toString(16);
}
