'use client';
import {useEffect,useRef,useState} from 'react';
import {readDraft,writeDraft} from './draft-storage';

export type ReadingRelationDraft={schema:1;open:boolean;selected:string[];label:string;text:string;editing?:string};
const empty=():ReadingRelationDraft=>({schema:1,open:false,selected:[],label:'',text:''});
function decode(value:unknown):ReadingRelationDraft{
 if(value===null)return empty();
 const d=value as ReadingRelationDraft;
 if(!d||d.schema!==1||typeof d.open!=='boolean'||!Array.isArray(d.selected)||d.selected.some(id=>typeof id!=='string')||typeof d.label!=='string'||typeof d.text!=='string'||d.editing!==undefined&&typeof d.editing!=='string')throw Error('联系草稿格式无法读取，原草稿尚未覆盖。');
 return {...d,selected:[...new Set(d.selected)]};
}
/** Separate from the formal relation: closing a reader never submits unfinished prose. */
export function useReadingRelationDraft(key:string){
 const [draft,setDraft]=useState<ReadingRelationDraft>(empty),[ready,setReady]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState(false);
 const state=useRef({key,value:empty(),version:0,saved:0,ready:false,loading:Promise.resolve()}),mounted=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 function change(update:(previous:ReadingRelationDraft)=>ReadingRelationDraft){
  const s=state.current;if(!s.ready)return;const next=update(s.value);s.value=next;s.version++;setDraft(next);setPending(true);setError('');
  clearTimeout(timer.current);timer.current=setTimeout(()=>{void persist().catch(()=>{});},300);
 }
 async function persist(s=state.current){
  if(!s.ready)throw Error('联系草稿尚未读取完成，请稍后再试。');
  if(s.saved===s.version)return;
  const version=s.version,value=s.value;
  try{await writeDraft(s.key,value.open?value:null);s.saved=Math.max(s.saved,version);if(mounted.current&&state.current===s&&s.version===version){setPending(false);setError('');}}
  catch(cause){if(mounted.current&&state.current===s&&s.version===version)setError((cause as Error).message||'联系草稿尚未保存');throw cause;}
 }
 useEffect(()=>{
  mounted.current=true;const s={key,value:empty(),version:0,saved:0,ready:false,loading:Promise.resolve()};state.current=s;setReady(false);setDraft(s.value);setPending(false);setError('');
  let canceled=false;
  const loading=readDraft<unknown>(key,null).then(value=>{if(canceled)return;s.value=decode(value);s.ready=true;setDraft(s.value);setReady(true);}).catch(cause=>{if(!canceled)setError((cause as Error).message);throw cause;});
  s.loading=loading;void loading.catch(()=>{});
  const flush=(event:Event)=>{const jobs=(event as CustomEvent<{jobs:Promise<unknown>[]}>).detail.jobs;jobs.push(loading.then(()=>persist(s)));};
  window.addEventListener('wenjian:flush-drafts',flush);
  return()=>{canceled=true;mounted.current=false;clearTimeout(timer.current);window.removeEventListener('wenjian:flush-drafts',flush);if(s.ready&&s.saved!==s.version)void writeDraft(s.key,s.value.open?s.value:null).catch(()=>{});};
 },[key]);
 return {draft,ready,error,pending,change,persist,flush:async()=>{const s=state.current;await s.loading;await persist(s);},clear:()=>change(()=>empty())};
}
