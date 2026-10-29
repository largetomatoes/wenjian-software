import type {BookThoughtSource} from './notebook';

export const READING_SOURCE_MIME='application/x-wenjian-reading-source';
export function putReadingSource(transfer:DataTransfer,source:BookThoughtSource){
 if(!source.quote?.trim()||!source.libraryBookId||!source.sourceLocation)return;
 transfer.setData(READING_SOURCE_MIME,JSON.stringify({version:1,source:{...source,origin:{kind:'selection'},capturedAt:source.capturedAt||new Date().toISOString()}}));
 transfer.setData('text/plain',source.quote);transfer.effectAllowed='copy';
}
export function getReadingSource(transfer:DataTransfer,pending?:BookThoughtSource|null):BookThoughtSource|null{
 const raw=transfer.getData(READING_SOURCE_MIME);
 if(raw){
  if(raw.length>400000)throw Error('这段摘录太长，请分成较短的几段拖入。');
  let packet:unknown;try{packet=JSON.parse(raw);}catch{throw Error('摘录没有完整传过来，请重新拖动选文。');}
  const p=packet as {version?:number;source?:BookThoughtSource},s=p?.source;
  if(p?.version!==1||!s||typeof s.id!=='string'||!s.id||typeof s.quote!=='string'||!s.quote.trim()||typeof s.libraryBookId!=='string'||!s.libraryBookId||typeof s.bookTitle!=='string'||typeof s.locator!=='string'||typeof s.sourceLocation!=='string'||!s.sourceLocation||[s.chapter,s.rawQuote,s.author].some(v=>v!==undefined&&typeof v!=='string'))throw Error('这段摘录的来源不完整，请重新选择原文。');
  return s;
 }
 // External plain text is ordinary text, never an inferred book citation.
 const text=transfer.getData('text/plain').replace(/\s+/g,'').trim();
 return pending?.quote&&text&&text===pending.quote.replace(/\s+/g,'').trim()?pending:null;
}
export function isReadingSourceDrag(transfer:DataTransfer,pending?:BookThoughtSource|null){return Array.from(transfer.types).includes(READING_SOURCE_MIME)||!!pending&&Array.from(transfer.types).includes('text/plain');}

// The mirror has exactly the same UTF-16 text as the native textarea.
export function readingDropPoint(mirror:HTMLElement,x:number,y:number,length:number,citations:Array<{start:number;end:number}>){
 const old=mirror.style.pointerEvents;mirror.style.pointerEvents='auto';
 try{
  const range=(document as Document&{caretRangeFromPoint?:(x:number,y:number)=>Range|null}).caretRangeFromPoint?.(x,y);
  if(!range||!mirror.contains(range.startContainer))return {offset:length,x:0,y:Math.max(0,mirror.scrollHeight-31),height:31};
  const prefix=document.createRange();prefix.selectNodeContents(mirror);prefix.setEnd(range.startContainer,range.startOffset);let offset=Math.min(length,prefix.toString().length);
  const hit=citations.find(c=>offset>c.start&&offset<c.end);if(hit)offset=offset-hit.start<(hit.end-hit.start)/2?hit.start:hit.end;
  const rect=range.getBoundingClientRect(),host=mirror.getBoundingClientRect();
  return {offset,x:Math.max(0,rect.left-host.left),y:Math.max(0,rect.top-host.top),height:rect.height||31};
 }finally{mirror.style.pointerEvents=old;}
}

export function pointerInReadingSelection(event:{clientX:number;clientY:number},doc:Document){
 const selection=doc.getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount)return false;
 return Array.from(selection.getRangeAt(0).getClientRects()).some(rect=>event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom);
}

export const READING_POINTER_DRAG='wenjian:reading-source-hover';
export const READING_POINTER_DROP='wenjian:reading-source-drop';
export const READING_POINTER_END='wenjian:reading-source-end';
export type ReadingPointerDetail={source:BookThoughtSource;clientX:number;clientY:number};
// A selected EPUB passage crosses iframe boundaries without entering macOS's
// synchronous native drag loop. This session is ephemeral and never writes data.
export function beginReadingPointerDrag(event:PointerEvent,sourceDoc:Document,source:BookThoughtSource,onEnd:()=>void){
 const hostDoc=document,frame=sourceDoc.defaultView?.frameElement as HTMLElement|null,start={x:event.clientX,y:event.clientY};let ended=false,moving=false;
 const ghost=hostDoc.createElement('div');ghost.textContent=(source.quote||'').slice(0,80);ghost.style.cssText='position:fixed;z-index:30000;pointer-events:none;max-width:260px;padding:9px 12px;border:1px solid #c5d0b8;border-radius:7px;background:#f8faf2;color:#56634a;font:12px/1.7 -apple-system,sans-serif;box-shadow:0 5px 16px #25371822;display:none';hostDoc.body.appendChild(ghost);
 const docs=sourceDoc===hostDoc?[hostDoc]:[sourceDoc,hostDoc],captor=sourceDoc.body;
 const point=(e:PointerEvent)=>{const fromSource=e.currentTarget===sourceDoc,rect=fromSource?frame?.getBoundingClientRect():undefined;return {clientX:rect?rect.left+e.clientX*(rect.width/(frame!.offsetWidth||rect.width)):e.clientX,clientY:rect?rect.top+e.clientY*(rect.height/(frame!.offsetHeight||rect.height)):e.clientY};};
 const emit=(name:string,p:{clientX:number;clientY:number})=>hostDoc.dispatchEvent(new CustomEvent<ReadingPointerDetail>(name,{detail:{source,...p}}));
 function stop(){if(ended)return;ended=true;for(const doc of docs){doc.removeEventListener('pointermove',move,true);doc.removeEventListener('pointerup',up,true);doc.removeEventListener('pointercancel',stop,true);doc.removeEventListener('keydown',key,true);}try{captor.releasePointerCapture(event.pointerId);}catch{}ghost.remove();hostDoc.dispatchEvent(new Event(READING_POINTER_END));onEnd();}
 function move(e:PointerEvent){if(e.pointerId!==event.pointerId)return;const p=point(e);if(!moving){if(e.currentTarget===sourceDoc&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<6)return;moving=true;ghost.style.display='block';}e.preventDefault();ghost.style.left=Math.min(window.innerWidth-275,p.clientX+15)+'px';ghost.style.top=Math.max(8,p.clientY+15)+'px';emit(READING_POINTER_DRAG,p);}
 function up(e:PointerEvent){if(e.pointerId!==event.pointerId)return;if(moving){e.preventDefault();emit(READING_POINTER_DROP,point(e));}stop();}
 function key(e:KeyboardEvent){if(e.key==='Escape'){e.preventDefault();stop();}}
 event.preventDefault();try{captor.setPointerCapture(event.pointerId);}catch{}
 for(const doc of docs){doc.addEventListener('pointermove',move,{capture:true,passive:false});doc.addEventListener('pointerup',up,true);doc.addEventListener('pointercancel',stop,true);doc.addEventListener('keydown',key,true);}
 return stop;
}

// epub.js can encode an element boundary as a character offset. Normalize only
// when the complete selected text remains byte-for-byte the same.
export function readingTextRange(input:Range){
 const range=input.cloneRange();if(range.startContainer.nodeType===3&&range.endContainer.nodeType===3)return range;
 const doc=range.startContainer.ownerDocument||document,walker=doc.createTreeWalker(range.commonAncestorContainer,4),nodes:Text[]=[];let node:Node|null;
 while(node=walker.nextNode())if(node.textContent?.length&&range.intersectsNode(node))nodes.push(node as Text);
 if(!nodes.length)return range;const next=range.cloneRange();if(next.startContainer.nodeType!==3)next.setStart(nodes[0],0);if(next.endContainer.nodeType!==3)next.setEnd(nodes.at(-1)!,nodes.at(-1)!.length);
 return next.toString()===range.toString()?next:range;
}
