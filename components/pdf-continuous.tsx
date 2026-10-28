'use client';
import {memo,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {isOptimizedReader} from '@/lib/reader-performance';
import {windowsCanvasRatio} from '@/lib/windows-reader-performance';
import {continueReaderRender} from '@/lib/reader-work';
import {OcrTextRuns} from './ocr-text-runs';
import {beginLocalTextDrag} from '@/lib/local-text-drag';
import {clearReaderSelections} from '@/lib/reader-shortcuts';
import {ProcessNoteRail} from './process-note-rail';
import {ZoteroNoteRail} from './zotero-note-rail';
import {cleanReadingText,reflowReadingExcerpt,rotateNormalizedRect,searchableText,textIndex,usablePdfText,OCR_VERSION} from '@/lib/reader-text';
import {processSources} from '@/lib/process-note-sources';
import {zoteroPdfRects} from '@/lib/zotero-position';
import {findBookText,readingTextNodes,rangeForMatch,type BookSearchHit} from '@/lib/book-search';
import type {BookThoughtSource,LibraryBook,LibraryHighlight,OcrCacheEntry,ReadingNote,ZoteroAnnotation} from '@/lib/notebook';
import './pdf-continuous.css';

type Rect={x:number;y:number;width:number;height:number};
export type PdfSegment={page:number;rawQuote:string;quote:string;anchorY?:number;rects:Rect[]};
export type ContinuousExcerpt={rawQuote:string;quote:string;locator:string;sourceLocation:string;chapter:string;anchorY?:number;rects?:Rect[];segments?:PdfSegment[];menu?:{x:number;y:number}};
export type ContinuousControl={jump:(page:number,offset?:number)=>void;getPosition:()=>{page:number;offset:number}|null;preservePosition:()=>void};
type Props={pdf:any;book:LibraryBook;count:number;initialPage:number;initialOffset:number;rotation:0|90|180|270;zoomMode:'width'|'page'|'custom';customZoom:number;cache:OcrCacheEntry[];highlights:LibraryHighlight[];notes:ReadingNote[];annotations:ZoteroAnnotation[];searchHit:BookSearchHit|null;paneKey:string;selectingShared:(event:MouseEvent)=>boolean;stageRef:(stage:HTMLDivElement|null)=>void;controlRef:React.MutableRefObject<ContinuousControl|null>;onPosition:(page:number,anchorPage:number,offset:number)=>void;onZoom:(scale:number)=>void;onExcerpt:(excerpt:ContinuousExcerpt,shared:boolean)=>void;onRecognize:(page:number)=>void;ocrBusy:boolean;active:boolean;onLink:(note:ReadingNote)=>void;onSource:(note:ReadingNote)=>void;onOpenQuestion?:(id:string)=>void;questionLabel:(id:string)=>string;renderEditor:(note:ReadingNote)=>ReactNode;onOpenZotero:(key:string)=>void;onDelete:(event:React.MouseEvent,page:number,ranges:Array<{id:string;range:Range}>,notes:ReadingNote[])=>void};

type Metrics={width:number;height:number};
function makeRanges(root:HTMLElement,highlights:Array<{id:string;quote:string}>){
 const nodes=readingTextNodes(root),raw=nodes.map(n=>n.data).join(''),indexed=textIndex(raw),starts:number[]=[];let length=0;
 for(const node of nodes){starts.push(length);length+=node.length;}
 const result:Array<{id:string;range:Range}>=[];
 for(const h of highlights){const q=searchableText(h.quote),found=q?indexed.text.indexOf(q):-1;if(found<0)continue;
  const start=indexed.offsets[found],end=indexed.offsets[found+q.length-1]+1;let a=0,b=nodes.length-1;
  while(a+1<nodes.length&&starts[a+1]<=start)a++;while(b>0&&starts[b]>end)b--;
  const range=document.createRange();range.setStart(nodes[a],start-starts[a]);range.setEnd(nodes[b],Math.min(nodes[b].length,end-starts[b]));result.push({id:h.id,range});
 }
 return result;
}
function selectedSegments(stage:HTMLElement,range:Range,rotation:number):PdfSegment[]{
 const items:PdfSegment[]=[];
 for(const paper of stage.querySelectorAll<HTMLElement>('.pdf-page[data-page]')){
  const page=Number(paper.dataset.page),root=paper.querySelector<HTMLElement>('.pdf-continuous-text[data-active=true]');
  if(!root||!range.intersectsNode(root))continue;
  const part=range.cloneRange();if(!root.contains(part.startContainer))part.setStart(root,0);if(!root.contains(part.endContainer))part.setEnd(root,root.childNodes.length);
  const rawQuote=cleanReadingText(part.toString()),quote=reflowReadingExcerpt(rawQuote),bounds=paper.getBoundingClientRect();if(!quote||!bounds.width||!bounds.height)continue;
  const rects=Array.from(part.getClientRects()).filter(r=>r.width>0&&r.height>0).map(r=>rotateNormalizedRect({x:(r.left-bounds.left)/bounds.width,y:(r.top-bounds.top)/bounds.height,width:r.width/bounds.width,height:r.height/bounds.height},(360-rotation)%360));
  const first=rects[0],anchorY=first?Math.max(0,Math.min(1,first.y+first.height/2)):undefined;
  items.push({page,rawQuote,quote,anchorY,rects});
 }
 return items.sort((a,b)=>a.page-b.page);
}
function pageNotes(notes:ReadingNote[],page:number){
 return notes.flatMap(note=>{const source=processSources(note).find(s=>s.id===note.sourceId);if(!source)return [];
  const segment=source.pdfSegments?.find(s=>s.page===page);if(segment)return [{...note,quote:segment.quote,rawQuote:segment.rawQuote,anchorY:segment.anchorY,sourceLocation:`pdf:${page}`}];
  return !source.pdfSegments?.length&&source.sourceLocation===`pdf:${page}`?[note]:[];
 });
}
function pageHighlights(highlights:LibraryHighlight[],page:number){return highlights.flatMap(h=>{
 const part=h.pdfSegments?.find(s=>s.page===page);return part?[{id:h.id,quote:part.rawQuote||part.quote}]:!h.pdfSegments?.length&&h.sourceLocation===`pdf:${page}`?[{id:h.id,quote:h.rawQuote||h.quote}]:[];
});}
const Page=memo(function Page({number,pdf,book,metric,scale,rotation,near,selecting,cache,highlights,notes,annotations,paneKey,searchHit,stage,onMeasured,onStatus,onOpenZotero,onLink,onSource,onOpenQuestion,questionLabel,renderEditor,onDelete}:{number:number;pdf:any;book:LibraryBook;metric:Metrics;scale:number;rotation:number;near:boolean;selecting:boolean;cache:OcrCacheEntry|undefined;highlights:LibraryHighlight[];notes:ReadingNote[];annotations:ZoteroAnnotation[];paneKey:string;searchHit:BookSearchHit|null;stage:HTMLElement|null;onMeasured:(page:number,metric:Metrics)=>void;onStatus:(page:number,status:'native'|'needs-ocr'|'cached'|'failed')=>void;onOpenZotero:(key:string)=>void;onLink:Props['onLink'];onSource:Props['onSource'];onOpenQuestion:Props['onOpenQuestion'];questionLabel:Props['questionLabel'];renderEditor:Props['renderEditor'];onDelete:Props['onDelete']}){
 const canvas=useRef<HTMLCanvasElement>(null),text=useRef<HTMLDivElement>(null),ocrRoot=useRef<HTMLDivElement>(null),ranges=useRef<Array<{id:string;range:Range}>>([]);
 const [viewport,setViewport]=useState<any>(null),[native,setNative]=useState(false),[ready,setReady]=useState(false);
 const pageH=useMemo(()=>near?pageHighlights(highlights,number):[],[near,highlights,number]),pageN=useMemo(()=>near?pageNotes(notes,number):[],[near,notes,number]);
 const stableCache=useRef(cache);if(!selecting)stableCache.current=cache;const selectedCache=stableCache.current&&(stableCache.current.rotation||0)===rotation?stableCache.current:undefined;
 const useOcr=!!selectedCache?.lines?.length&&(!native||selectedCache.preferOcr);
 useEffect(()=>{
  if(!near)return;let cancelled=false,renderTask:any=null,textTask:any=null,pdfPage:any=null;const controller=new AbortController();setReady(false);
  void(async()=>{try{pdfPage=await pdf.getPage(number);if(cancelled){pdfPage.cleanup?.();return;}const base=pdfPage.getViewport({scale:1,rotation});onMeasured(number,{width:base.width,height:base.height});
   const view=pdfPage.getViewport({scale,rotation}),content=await pdfPage.getTextContent();if(cancelled)return;
   const usable=usablePdfText(content.items.filter((item:any)=>item.str))&&!selectedCache?.preferOcr;
   const image=canvas.current,layer=text.current;if(!image||!layer)return;
   const ratio=isOptimizedReader()?windowsCanvasRatio(view.width,view.height,window.devicePixelRatio||1):Math.min(window.devicePixelRatio||1,Math.sqrt(9000000/(view.width*view.height)));image.width=Math.max(1,Math.floor(view.width*ratio));image.height=Math.max(1,Math.floor(view.height*ratio));image.style.width=`${view.width}px`;image.style.height=`${view.height}px`;
   renderTask=pdfPage.render({canvasContext:image.getContext('2d'),viewport:view,transform:[ratio,0,0,ratio,0,0]});if(isOptimizedReader())renderTask.onContinue=(resume:()=>void)=>continueReaderRender(resume,controller.signal);await renderTask.promise;if(cancelled)return;
   const target=document.createElement('div');target.style.setProperty('--total-scale-factor',String(scale));
   if(usable){const pdfjs=await import('pdfjs-dist');textTask=new pdfjs.TextLayer({textContentSource:content,container:target,viewport:view});await textTask.render();}
   if(cancelled)return;layer.replaceChildren(...Array.from(target.childNodes));setNative(usable);setViewport(view);setReady(true);onStatus(number,usable?'native':selectedCache?.lines?.length&&selectedCache.version===OCR_VERSION?'cached':'needs-ocr');
  }catch(error){if(!cancelled&&(error as Error).name!=='RenderingCancelledException'){console.error('PDF page render failed',error);onStatus(number,'failed');}}})();
  return()=>{cancelled=true;controller.abort();renderTask?.cancel?.();textTask?.cancel?.();const releasePage=()=>{try{pdfPage?.cleanup?.();}catch{/* PDF.js will clean remaining active tasks when the document closes. */}};if(renderTask?.promise)void renderTask.promise.catch(()=>{}).finally(releasePage);else releasePage();};
 },[near,pdf,number,scale,rotation,selectedCache?.at,selectedCache?.preferOcr]);
 useEffect(()=>{if(!near||!ready||selecting)return;const root=useOcr?ocrRoot.current:text.current;if(!root)return;
  const name=`wenjian-pdf-${paneKey.replace(/[^a-zA-Z0-9_-]/g,'-')}-page-${number}`,registry=(CSS as any).highlights,Ctor=(window as any).Highlight;
  ranges.current=makeRanges(root,pageH);if(registry&&Ctor){if(!document.getElementById(name+'-style')){const style=document.createElement('style');style.id=name+'-style';style.textContent=`::highlight(${name}){background:rgba(246,214,105,.28)}`;document.head.appendChild(style);}registry.delete(name);if(ranges.current.length)registry.set(name,new Ctor(...ranges.current.map(x=>x.range)));}
  else for(const span of root.querySelectorAll('span')){const value=searchableText(span.textContent||'');span.classList.toggle('is-pdf-highlighted',!!value&&pageH.some(h=>searchableText(h.quote).includes(value)));}
  return()=>{registry?.delete(name);document.getElementById(name+'-style')?.remove();};
 },[near,ready,useOcr,selectedCache?.at,pageH,number,paneKey,selecting]);
 useEffect(()=>{if(!near||!ready||selecting||!searchHit||searchHit.location!==`pdf:${number}`||!stage)return;const root=useOcr?ocrRoot.current:text.current;if(!root)return;
  const nodes=readingTextNodes(root),raw=nodes.map(n=>n.data).join(''),match=findBookText(raw,searchHit.query,searchHit.occurrence+1)[searchHit.occurrence],range=match&&rangeForMatch(nodes,match.start,match.end);if(!range)return;
  const name=`wenjian-continuous-search-${paneKey}`,registry=(CSS as any).highlights,Ctor=(window as any).Highlight;if(registry&&Ctor){if(!document.getElementById(name+'-style')){const style=document.createElement('style');style.id=name+'-style';style.textContent=`::highlight(${name}){background:rgba(118,181,211,.48)}`;document.head.appendChild(style);}registry.set(name,new Ctor(range));}
  const rect=range.getBoundingClientRect(),bounds=stage.getBoundingClientRect(),factor=bounds.height/(stage.offsetHeight||bounds.height)||1;stage.scrollTo({top:stage.scrollTop+(rect.top-bounds.top)/factor-stage.clientHeight*.35,behavior:'smooth'});
  return()=>{registry?.delete(name);document.getElementById(name+'-style')?.remove();};
 },[searchHit,near,ready,useOcr,selectedCache?.at,number,paneKey,stage,selecting]);
 const zrects=useMemo(()=>viewport&&(!book.zotero?.sourceFile||book.zotero.sourceFile===book.storedFile)?annotations.filter(a=>a.attachmentKey===book.zotero?.attachmentKey).flatMap(a=>zoteroPdfRects(a,number,viewport).map(rect=>({...rect,key:a.key,color:/^#[0-9a-f]{6}$/i.test(a.color||'')?a.color!:'#ffd400'}))):[],[viewport,annotations,number,book.zotero?.attachmentKey,book.zotero?.sourceFile,book.storedFile]);
 const width=metric.width*scale,height=metric.height*scale;
 return <div className="pdf-page" data-page={number} style={{width,height,'--total-scale-factor':scale} as React.CSSProperties} onClick={event=>onDelete(event,number,ranges.current,pageN)}>
  {near&&<><canvas ref={canvas}/><div className="process-pdf-overlay" aria-hidden="true">{pageN.flatMap(note=>{const source=processSources(note).find(s=>s.id===note.sourceId),segment=source?.pdfSegments?.find(s=>s.page===number);return (segment?.rects||source?.rects||[]).map((r,index)=>{const rect=rotateNormalizedRect(r,rotation);return <i key={`${note.id}:${note.sourceId}:${index}`} style={{left:rect.x*width,top:rect.y*height,width:rect.width*width,height:rect.height*height}}/>;});})}</div>
   <div className="zotero-pdf-overlay" aria-hidden="true">{zrects.map((r,i)=><i key={r.key+':'+i} style={{left:r.left,top:r.top,width:r.width,height:r.height,background:r.color+'44'}}/>)}</div><ZoteroNoteRail anchors={zrects} annotations={annotations} onOpen={onOpenZotero}/>
   <div ref={text} className="textLayer pdf-continuous-text" data-active={!useOcr}/>{useOcr&&<div ref={ocrRoot} className="ocr-text-layer pdf-continuous-text" data-active="true"><OcrTextRuns lines={selectedCache!.lines!} width={width} height={height}/></div>}
   {!!pageN.length&&<ProcessNoteRail entries={pageN.map((note,index)=>{const source=processSources(note).find(s=>s.id===note.sourceId),segment=source?.pdfSegments?.find(s=>s.page===number),box=segment?.rects?.[0]||source?.rects?.[0];const rect=box&&rotateNormalizedRect(box,rotation);return {item:note,y:(rect?rect.y+rect.height/2:note.anchorY??Math.max(.08,Math.min(.92,(index+1)/(pageN.length+1))))*height};})} height={height} onLink={onLink} onSource={onSource} onOpenQuestion={onOpenQuestion} questionLabel={questionLabel} renderEditor={renderEditor}/>}</>}
 </div>;
},(a,b)=>!a.near&&!b.near&&a.number===b.number&&a.scale===b.scale&&a.rotation===b.rotation&&a.metric.width===b.metric.width&&a.metric.height===b.metric.height);

export function PdfContinuous(props:Props){
 const {pdf,book,count,initialPage,initialOffset,rotation,zoomMode,customZoom,cache,highlights,notes,annotations,searchHit,paneKey}=props;
 const stage=useRef<HTMLDivElement|null>(null),callbacks=useRef(props);callbacks.current=props;
 const [stageEl,setStageEl]=useState<HTMLDivElement|null>(null),[size,setSize]=useState({width:0,height:0}),[metrics,setMetrics]=useState<Record<number,Metrics>>({}),[near,setNear]=useState<Set<number>>(new Set([initialPage])),[visible,setVisible]=useState(initialPage),[selecting,setSelecting]=useState(false),[scrollBusy,setScrollBusy]=useState(false),[statuses,setStatuses]=useState<Record<number,string>>({});
 const visiblePagesRef=useRef(new Set<number>()),previousRotation=useRef(rotation);const initial=useRef(true),anchor=useRef<{page:number;fraction:number}|null>(null),dragging=useRef(false),shared=useRef(false),retained=useRef(new Set<number>()),visibleRef=useRef(initialPage),positionTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const first=metrics[1]||Object.values(metrics)[0]||(rotation===90||rotation===270?{width:842,height:595}:{width:595,height:842});
 const availableWidth=Math.max(120,size.width-64),availableHeight=Math.max(120,size.height-40);
 const scale=Math.max(.25,Math.min(3,zoomMode==='custom'?customZoom:zoomMode==='page'?Math.min(availableWidth/first.width,availableHeight/first.height):availableWidth/first.width));
 const capture=useCallback(()=>{const container=stage.current;if(!container)return null;const bounds=container.getBoundingClientRect(),visible=[...visiblePagesRef.current].map(n=>container.querySelector<HTMLElement>(`.pdf-page[data-page="${n}"]`)).filter((p):p is HTMLElement=>!!p).filter(p=>{const r=p.getBoundingClientRect();return r.bottom>bounds.top&&r.top<bounds.bottom;}).sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);const paper=visible[0]||Array.from(container.querySelectorAll<HTMLElement>('.pdf-page[data-page]')).find(p=>p.getBoundingClientRect().bottom>bounds.top);if(!paper)return null;const r=paper.getBoundingClientRect();return {page:Number(paper.dataset.page),fraction:r.height?Math.max(0,Math.min(1,(bounds.top-r.top)/r.height)):0};},[]);
 const measure=useCallback((page:number,next:Metrics)=>{setMetrics(previous=>{const old=previous[page];if(old&&Math.abs(old.width-next.width)<.01&&Math.abs(old.height-next.height)<.01)return previous;anchor.current=capture();return {...previous,[page]:next};});},[capture]);
 useLayoutEffect(()=>{const difference=(rotation-previousRotation.current+360)%360;previousRotation.current=rotation;if(difference===90||difference===270){anchor.current=capture();setMetrics(old=>Object.fromEntries(Object.entries(old).map(([key,m])=>[key,{width:m.height,height:m.width}])));}},[rotation,capture]);
 const updateStatus=useCallback((n:number,s:string)=>setStatuses(previous=>previous[n]===s?previous:{...previous,[n]:s}),[]);
 const ref=useCallback((el:HTMLDivElement|null)=>{stage.current=el;setStageEl(el);callbacks.current.stageRef(el);},[]);
 useLayoutEffect(()=>{if(!stageEl)return;const update=()=>{anchor.current=capture();setSize(old=>old.width===stageEl.clientWidth&&old.height===stageEl.clientHeight?old:{width:stageEl.clientWidth,height:stageEl.clientHeight});};update();const ro=new ResizeObserver(update);ro.observe(stageEl);return()=>ro.disconnect();},[stageEl,capture]);
 useLayoutEffect(()=>{const el=stage.current;if(!el||!size.width)return;const a=initial.current?{page:initialPage,fraction:initialOffset}:anchor.current;if(!a)return;const paper=el.querySelector<HTMLElement>(`.pdf-page[data-page="${a.page}"]`);if(!paper)return;const bounds=el.getBoundingClientRect(),factor=bounds.height/(el.offsetHeight||bounds.height)||1,r=paper.getBoundingClientRect();el.scrollTop+=(r.top+r.height*a.fraction-bounds.top)/factor;initial.current=false;anchor.current=null;},[metrics,size.width,size.height,scale,initialPage,initialOffset]);
 useEffect(()=>{callbacks.current.onZoom(scale);},[scale]);
 useEffect(()=>{if(!stageEl||!size.width)return;const visiblePages=visiblePagesRef.current;visiblePages.clear();let frame=0;
  const update=()=>{const bounds=stageEl.getBoundingClientRect();let best=visibleRef.current,bestPixels=-1;for(const n of visiblePages){const element=stageEl.querySelector<HTMLElement>(`.pdf-page[data-page="${n}"]`);if(!element)continue;const r=element.getBoundingClientRect(),pixels=Math.max(0,Math.min(bounds.bottom,r.bottom)-Math.max(bounds.top,r.top));if(pixels>bestPixels){best=n;bestPixels=pixels;}}if(bestPixels<=0)return;visibleRef.current=best;setVisible(best);const current=capture();callbacks.current.onPosition(best,current?.page||best,current?.fraction||0);};
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};const onScroll=()=>{setScrollBusy(true);if(positionTimer.current)clearTimeout(positionTimer.current);positionTimer.current=setTimeout(()=>setScrollBusy(false),500);schedule();};
  const visibility=new IntersectionObserver(entries=>{for(const entry of entries){const n=Number((entry.target as HTMLElement).dataset.page);if(entry.isIntersecting)visiblePages.add(n);else visiblePages.delete(n);}schedule();},{root:stageEl,threshold:[0,.01,.25,.5,.75,1]});
  const nearby=new IntersectionObserver(entries=>{setNear(old=>{const next=new Set(old);for(const entry of entries){const n=Number((entry.target as HTMLElement).dataset.page);if(entry.isIntersecting){next.add(n);if(dragging.current)retained.current.add(n);}else next.delete(n);}return next;});},{root:stageEl,rootMargin:'100% 0px'});
  for(const paper of stageEl.querySelectorAll('.pdf-page[data-page]')){visibility.observe(paper);nearby.observe(paper);}stageEl.addEventListener('scroll',onScroll,{passive:true});schedule();
  return()=>{cancelAnimationFrame(frame);visibility.disconnect();nearby.disconnect();visiblePages.clear();stageEl.removeEventListener('scroll',onScroll);if(positionTimer.current)clearTimeout(positionTimer.current);};
 },[stageEl,count,size.width,capture]);
 useEffect(()=>{callbacks.current.controlRef.current={jump:(n,offset=0)=>{const el=stage.current,p=el?.querySelector<HTMLElement>(`.pdf-page[data-page="${Math.max(1,Math.min(count,n))}"]`);if(!el||!p)return;const a=el.getBoundingClientRect(),b=p.getBoundingClientRect(),factor=a.height/(el.offsetHeight||a.height)||1;el.scrollTop+=(b.top+b.height*offset-a.top)/factor;},getPosition:()=>{const value=capture();return value?{page:value.page,offset:value.fraction}:null;},preservePosition:()=>{anchor.current=capture();}};return()=>{callbacks.current.controlRef.current=null;};},[count,capture]);
 useEffect(()=>{if(!stageEl||!size.width||scrollBusy||!props.active||props.ocrBusy||statuses[visible]!=='needs-ocr')return;const timer=setTimeout(()=>{if(!document.hidden&&!dragging.current)callbacks.current.onRecognize(visible);},650);return()=>clearTimeout(timer);},[visible,statuses,props.ocrBusy,props.active,stageEl,size.width,scrollBusy]);
 useEffect(()=>{const stop=()=>{if(!dragging.current)return;dragging.current=false;setSelecting(false);retained.current.clear();};window.addEventListener('mouseup',stop);window.addEventListener('blur',stop);return()=>{window.removeEventListener('mouseup',stop);window.removeEventListener('blur',stop);};},[]);
 const stopDrag=()=>{dragging.current=false;setSelecting(false);retained.current.clear();};
 const collect=(range:Range,asShared:boolean)=>{const container=stage.current;if(!container)return;const parts=selectedSegments(container,range,rotation);if(!parts.length)return;const rawQuote=parts.map(p=>p.rawQuote).join('\n'),quote=reflowReadingExcerpt(rawQuote),first=parts[0],last=parts.at(-1)!,rect=range.getBoundingClientRect(),workspace=container.closest('.reader-workspace')?.getBoundingClientRect(),menu=workspace&&!window.matchMedia('(pointer: coarse)').matches?{x:Math.max(12,Math.min(workspace.width-290,rect.right-workspace.left+12)),y:Math.max(78,Math.min(workspace.height-78,rect.top+rect.height/2-workspace.top))}:undefined;
  callbacks.current.onExcerpt({quote,rawQuote,locator:first.page===last.page?`第 ${first.page} 页`:`第 ${first.page}–${last.page} 页`,sourceLocation:`pdf:${first.page}`,chapter:`第 ${first.page} 页`,anchorY:first.anchorY,rects:first.rects,segments:parts.length>1?parts:undefined,menu},asShared);
 };
 const collectRef=useRef(collect);collectRef.current=collect;
 useEffect(()=>{if(!stageEl||!window.matchMedia('(pointer: coarse)').matches)return;let timer:ReturnType<typeof setTimeout>|undefined;const changed=()=>{if(timer)clearTimeout(timer);const selection=window.getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount||!stageEl.contains(selection.anchorNode)||!stageEl.contains(selection.focusNode)){if(dragging.current){dragging.current=false;retained.current.clear();setSelecting(false);}return;}dragging.current=true;retained.current=new Set(near);setSelecting(true);timer=setTimeout(()=>{const current=window.getSelection();if(current&&!current.isCollapsed&&current.rangeCount&&stageEl.contains(current.anchorNode)&&stageEl.contains(current.focusNode))collectRef.current(current.getRangeAt(0),false);dragging.current=false;retained.current.clear();setSelecting(false);},450);};document.addEventListener('selectionchange',changed);return()=>{document.removeEventListener('selectionchange',changed);if(timer)clearTimeout(timer);};},[stageEl,near]);
 const down=(event:React.MouseEvent)=>{if(event.button!==0||!(event.target as HTMLElement).closest('.pdf-continuous-text'))return;dragging.current=true;shared.current=callbacks.current.selectingShared(event.nativeEvent);retained.current=new Set(near);setSelecting(true);if(shared.current&&stage.current){clearReaderSelections(document);beginLocalTextDrag(event.nativeEvent,stage.current,range=>collect(range,true),stopDrag);}};
 const finish=()=>{if(!dragging.current)return;const selection=window.getSelection();if(selection&&!selection.isCollapsed&&selection.rangeCount)collect(selection.getRangeAt(0),shared.current);};
 const pages=useMemo(()=>Array.from({length:count},(_,i)=>i+1),[count]);const cachedPages=useMemo(()=>{const map=new Map<number,OcrCacheEntry>();for(const entry of cache)if(entry.libraryBookId===book.id&&(entry.rotation||0)===rotation)map.set(entry.page,entry);return map;},[cache,book.id,rotation]);
 return <div ref={ref} className={`pdf-stage pdf-continuous fit-${zoomMode}`} aria-label="PDF 连续阅读" onMouseDown={down} onMouseUp={finish} onCopy={event=>{const text=window.getSelection()?.toString();if(text){event.preventDefault();event.clipboardData.setData('text/plain',reflowReadingExcerpt(text));}}}>
  {size.width>0&&pages.map(n=><Page key={n} number={n} pdf={pdf} book={book} metric={metrics[n]||first} scale={scale} rotation={rotation} near={near.has(n)||selecting&&retained.current.has(n)} selecting={selecting} cache={cachedPages.get(n)} highlights={highlights} notes={notes} annotations={annotations} paneKey={paneKey} searchHit={searchHit} stage={stageEl} onMeasured={measure} onStatus={updateStatus} onOpenZotero={props.onOpenZotero} onLink={props.onLink} onSource={props.onSource} onOpenQuestion={props.onOpenQuestion} questionLabel={props.questionLabel} renderEditor={props.renderEditor} onDelete={props.onDelete}/>)}
 </div>;
}
