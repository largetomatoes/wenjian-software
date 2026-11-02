'use client';
import {forwardRef,useEffect,useLayoutEffect,useRef,useState,type ChangeEvent,type ComponentProps} from 'react';
import {flushSync} from 'react-dom';
import {Textarea} from './ui/textarea';
const pendingInputs=new Set<()=>void>();
let installed=false;
export function flushLocalInputs(){for(const flush of [...pendingInputs])flush();}
function install(){if(installed)return;installed=true;
 // Capture runs before React button/submit handlers and before draft flush
 // listeners, so the final keystroke participates in saves and navigation.
 document.addEventListener('pointerdown',flushLocalInputs,true);
 document.addEventListener('submit',flushLocalInputs,true);
 document.addEventListener('keydown',event=>{if(['Escape','Tab'].includes(event.key)||event.key==='Enter'&&(event.metaKey||event.ctrlKey))flushLocalInputs();},true);
 window.addEventListener('wenjian:flush-drafts',flushLocalInputs,true);
 window.addEventListener('blur',flushLocalInputs);
}
/** The native text value updates on every input. Only publishing it to the
 * surrounding screen is coalesced; IME and selection remain native. */
export const LocalTextarea=forwardRef<HTMLTextAreaElement,ComponentProps<typeof Textarea>>(function LocalTextarea({value,onChange,...props},forwarded){
 const [text,setText]=useState(String(value??'')),node=useRef<HTMLTextAreaElement|null>(null),latest=useRef(onChange),timer=useRef<ReturnType<typeof setTimeout>|null>(null),pending=useRef<ChangeEvent<HTMLTextAreaElement>|null>(null),composing=useRef(false);
 latest.current=onChange;
 const flush=useRef(()=>{});flush.current=()=>{if(!pending.current)return;const event=pending.current;pending.current=null;if(timer.current)clearTimeout(timer.current);pendingInputs.delete(commit);flushSync(()=>latest.current?.(event));};
 const commit=useRef(()=>flush.current()).current;
 useEffect(()=>{install();return()=>{if(timer.current)clearTimeout(timer.current);pendingInputs.delete(commit);};},[commit]);
 useLayoutEffect(()=>{if(!pending.current&&!composing.current)setText(String(value??''));},[value]);
 return <Textarea {...props} ref={element=>{node.current=element;if(typeof forwarded==='function')forwarded(element);else if(forwarded)forwarded.current=element;}} value={text} onChange={event=>{event.persist();setText(event.target.value);pending.current=event;pendingInputs.add(commit);if(timer.current)clearTimeout(timer.current);if(!composing.current)timer.current=setTimeout(commit,120);}} onCompositionStart={event=>{composing.current=true;props.onCompositionStart?.(event);}} onCompositionEnd={event=>{composing.current=false;props.onCompositionEnd?.(event);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(commit,0);}} onBlur={event=>{commit();props.onBlur?.(event);}}/>;
});
