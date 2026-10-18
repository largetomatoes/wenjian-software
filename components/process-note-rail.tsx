'use client';
import {useEffect,useId,useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {MessageSquareText} from 'lucide-react';
import type {ReadingNote} from '@/lib/notebook';
import {groupNoteAnchors} from '@/lib/reader-text';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
function NoteMarker({items,y,onOpen,host}:{items:ReadingNote[];y:number;onOpen:()=>void;host:HTMLElement|null}){
 const button=useRef<HTMLButtonElement>(null),preview=useRef<HTMLDivElement>(null),closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [show,setShow]=useState(false),[position,setPosition]=useState<CSSProperties|null>(null),previewId=useId();
 const keepOpen=()=>{if(closeTimer.current)clearTimeout(closeTimer.current);closeTimer.current=null;};
 const closeSoon=()=>{if(closeTimer.current)return;closeTimer.current=setTimeout(()=>{closeTimer.current=null;if(preview.current?.matches(':hover,:focus-within')||button.current?.matches(':focus-visible'))return;setShow(false);},140);};
 useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current);},[]);
 useLayoutEffect(()=>{
  if(!show||!host)return;
  let frame=0;
  const place=()=>{const element=button.current;if(!element)return;
   const marker=element.getBoundingClientRect(),stage=element.closest('.pdf-stage,.epub-reader-stage')?.getBoundingClientRect();
   const origin=host.getBoundingClientRect();
   const left=Math.max(8,stage?.left??8),right=Math.min(window.innerWidth-8,stage?.right??window.innerWidth-8),top=Math.max(8,stage?.top??8),bottom=Math.min(window.innerHeight-8,stage?.bottom??window.innerHeight-8);
   if(marker.bottom<top||marker.top>bottom||marker.right<left||marker.left>right){setShow(false);return;}
   const width=Math.max(0,Math.min(340,right-left-24)),maxHeight=Math.max(0,Math.min(380,bottom-top-24));
   const next={width,maxHeight,left:Math.max(left+12,Math.min(right-width-12,marker.left-width-8))-origin.left,top:Math.max(top+12,Math.min(marker.top,bottom-maxHeight-12))-origin.top};
   setPosition(previous=>previous&&Object.entries(next).every(([key,value])=>previous[key as keyof CSSProperties]===value)?previous:next);
  };
  const schedule=(event?:Event)=>{if(event?.target instanceof Node&&preview.current?.contains(event.target))return;cancelAnimationFrame(frame);frame=requestAnimationFrame(place);};
  // Keep the diagonal corridor to the preview open, even when a slow pointer crosses its gap.
  const track=(event:PointerEvent)=>{
   const marker=button.current,card=preview.current;if(!marker||!card)return;
   if(event.target instanceof Node&&(marker.contains(event.target)||card.contains(event.target))){keepOpen();return;}
   const a=marker.getBoundingClientRect(),b=card.getBoundingClientRect(),left=b.left<a.left;
   const start=left?a.right:a.left,end=left?b.right:b.left,t=(event.clientX-start)/(end-start);
   if(t>=0&&t<=1&&event.clientY>=a.top+(b.top-a.top)*t-10&&event.clientY<=a.bottom+(b.bottom-a.bottom)*t+10){keepOpen();return;}
   closeSoon();
  };
  place();window.addEventListener('resize',schedule);document.addEventListener('scroll',schedule,true);
  document.addEventListener('pointermove',track,true);
  const observer=new ResizeObserver(()=>schedule());observer.observe(host);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule);document.removeEventListener('scroll',schedule,true);document.removeEventListener('pointermove',track,true);};
 },[show,host,y]);
 return <><button ref={button} type="button" className="process-group-marker" style={{top:y}} aria-label={`查看 ${items.length} 条过程笔记`} aria-describedby={show?previewId:undefined} onPointerEnter={event=>{if(event.pointerType!=='touch'){keepOpen();setShow(true);}}} onPointerLeave={closeSoon} onFocus={()=>{keepOpen();setShow(true);}} onBlur={closeSoon} onKeyDown={event=>{if(event.key==='Escape'){keepOpen();setShow(false);event.stopPropagation();}}} onClick={()=>{keepOpen();setShow(false);onOpen();}}>
  <MessageSquareText/>{items.length>1&&<b>{items.length}</b>}
 </button>{show&&host&&createPortal(<div ref={preview} id={previewId} className="process-group-preview" style={position||{visibility:'hidden'}} role="tooltip" onPointerEnter={keepOpen} onPointerLeave={closeSoon} onFocusCapture={keepOpen} onBlurCapture={closeSoon} onClick={event=>event.stopPropagation()} onWheel={event=>event.stopPropagation()}>
   {items.slice(0,3).map(note=><span className="process-preview-entry" key={note.id+':'+(note.sourceId||'')}><span className="process-preview-quote">{note.quote}</span><span className="process-preview-comment">{note.interpretation}</span></span>)}
   {items.length>3&&<small>点击查看全部 {items.length} 条</small>}
  </div>,host)}</>;
}
export function ProcessNoteRail({entries,height,onLink,onSource,onOpenQuestion,questionLabel,renderEditor}:{entries:Array<{item:ReadingNote;y:number}>;height:number;renderEditor?:(note:ReadingNote)=>ReactNode;onLink:(note:ReadingNote)=>void;onSource:(note:ReadingNote)=>void;onOpenQuestion?:(id:string)=>void;questionLabel?:(id:string)=>string}){
 const [ids,setIds]=useState<string[]>([]);
 const rail=useRef<HTMLDivElement>(null),[host,setHost]=useState<HTMLElement|null>(null);
 useLayoutEffect(()=>{const root=rail.current?.closest('.reader-workspace');if(!root)return;const overlay=document.createElement('div');overlay.className='process-preview-host';root.appendChild(overlay);setHost(overlay);return()=>{overlay.remove();};},[]);
 const notes=entries.filter(entry=>ids.includes(entry.item.id+':'+(entry.item.sourceId||''))).map(entry=>entry.item);
 return <><div ref={rail} className="process-note-rail" aria-label="本页过程笔记">{groupNoteAnchors(entries,height).map(group=><NoteMarker key={group.items.map(n=>n.id+':'+(n.sourceId||'')).join(':')} items={group.items} y={group.y} host={host} onOpen={()=>setIds(group.items.map(n=>n.id+':'+(n.sourceId||'')))}/>)}</div><Dialog open={notes.length>0} onOpenChange={open=>{if(!open)setIds([]);}}><DialogContent className="process-group-dialog"><DialogTitle>过程笔记 · {notes.length}</DialogTitle><DialogDescription>同一位置的注解分别保留。</DialogDescription><div className="process-group-list">{notes.map(note=><article key={note.id+':'+(note.sourceId||'')}><small>{[note.chapter,note.locator].filter(Boolean).join(' · ')} · {new Date(note.at).toLocaleString('zh-CN')}</small><blockquote>{note.quote}</blockquote><p>{note.interpretation}</p>{onOpenQuestion&&!!note.questionIds.length&&<div className="book-thought-links">{note.questionIds.map(id=><button type="button" key={id} onClick={()=>{setIds([]);onOpenQuestion(id);}}>{questionLabel?.(id)||'查看关联问题'}</button>)}</div>}<footer>{renderEditor?.(note)}<button onClick={()=>onLink(note)}>关联问题{note.questionIds.length?` · ${note.questionIds.length}`:''}</button><button onClick={()=>{setIds([]);onSource(note);}}>回到原文</button></footer></article>)}</div></DialogContent></Dialog></>;
}
