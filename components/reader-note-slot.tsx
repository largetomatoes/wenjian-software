'use client';
import {createContext,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
export const ReaderNoteEditing=createContext<(editing:boolean)=>void>(()=>{});
export function useReaderNoteEditing(){return useContext(ReaderNoteEditing);}
const anchors=new WeakMap<Element,{node:Element;top:number;scrollTop:number}>();
const observers=new WeakMap<Element,{observer:IntersectionObserver;callbacks:Map<Element,(visible:boolean)=>void>}>();
function captureAnchor(scroller:Element){
 if(anchors.has(scroller))return;const bounds=scroller.getBoundingClientRect(),hit=document.elementFromPoint(bounds.left+bounds.width/2,bounds.top+Math.min(80,bounds.height/2)),node=hit?.closest('[data-note-slot]');
 if(node&&scroller.contains(node)){anchors.set(scroller,{node,top:node.getBoundingClientRect().top,scrollTop:scroller.scrollTop});requestAnimationFrame(()=>restoreAnchor(scroller));}
}
function restoreAnchor(scroller:Element){queueMicrotask(()=>{const anchor=anchors.get(scroller);if(!anchor)return;anchors.delete(scroller);if(scroller.scrollTop===anchor.scrollTop&&scroller.contains(anchor.node))scroller.scrollTop+=anchor.node.getBoundingClientRect().top-anchor.top;});}
function observeSlot(node:Element,update:(visible:boolean)=>void,selector:string){
 const scroller=node.closest(selector)||document.documentElement;let group=observers.get(scroller);
 if(!group){const callbacks=new Map<Element,(visible:boolean)=>void>(),observer=new IntersectionObserver(entries=>{captureAnchor(scroller);for(const entry of entries)callbacks.get(entry.target)?.(entry.isIntersecting||!!window.getSelection()?.containsNode(entry.target,true));},{root:scroller,rootMargin:'800px 0px'});group={observer,callbacks};observers.set(scroller,group);}
 group.callbacks.set(node,update);group.observer.observe(node);return()=>{group!.observer.unobserve(node);group!.callbacks.delete(node);if(!group!.callbacks.size){group!.observer.disconnect();observers.delete(scroller);anchors.delete(scroller);}};
}
// An open editor remains mounted, including its portalled dialog.
export function ReaderNoteSlot({id,render,pinned=false,initialHeight=480,scrollerSelector='.book-thoughts-scroll'}:{id:string;render:()=>ReactNode;pinned?:boolean;initialHeight?:number;scrollerSelector?:string}){
 const root=useRef<HTMLDivElement>(null),[height,setHeight]=useState(initialHeight),[visible,setVisible]=useState(false),[editing,setEditing]=useState(false);
 const mounted=visible||editing||pinned;
 useEffect(()=>{const node=root.current;if(node)return observeSlot(node,setVisible,scrollerSelector);},[]);
 useLayoutEffect(()=>{const node=root.current;if(!node)return;const scroller=node.closest(scrollerSelector);if(scroller)restoreAnchor(scroller);if(!mounted)return;const update=()=>{const measured=node.getBoundingClientRect().height;if(measured)setHeight(previous=>previous===measured?previous:measured);};update();const observer=new ResizeObserver(update);observer.observe(node);return()=>observer.disconnect();},[mounted]);
 return <div ref={root} className="reader-note-slot" data-note-slot={id} style={mounted?undefined:{height}}><ReaderNoteEditing.Provider value={setEditing}>{mounted?render():null}</ReaderNoteEditing.Provider></div>;
}
