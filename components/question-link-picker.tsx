'use client';
import {useMemo,useState} from 'react';
import {ChevronRight,Search,Network} from 'lucide-react';
import type {Notebook} from '@/lib/notebook';
import {questionChoices,questionPath,type QuestionChoice} from '@/lib/question-links';
import './question-link-picker.css';
export function QuestionLinkPicker({data,selected,onChange,disabled=false,disabledIds=[],limit=Infinity,initialOpen=false}:{data:Notebook;selected:string[];onChange:(ids:string[])=>void;disabled?:boolean;disabledIds?:string[];limit?:number;initialOpen?:boolean}){
 const [open,setOpen]=useState(initialOpen),[query,setQuery]=useState(''),[expanded,setExpanded]=useState<Set<string>>(()=>new Set());
 const roots=useMemo(()=>questionChoices(data),[data.notes,data.crossThoughts,data.questionPages]),needle=query.trim().toLocaleLowerCase();
 const search=(node:QuestionChoice):QuestionChoice|null=>{const children=node.children.map(search).filter((n):n is QuestionChoice=>!!n),hit=[node.title,node.code,node.path,...(node.anchors||[]).map(a=>a.label)].join(' ').toLocaleLowerCase().includes(needle);return hit?node:children.length?{...node,children}:null;};
 const shown=needle?roots.map(search).filter((n):n is QuestionChoice=>!!n):roots;
 const toggle=(id:string)=>onChange(selected.includes(id)?selected.filter(key=>key!==id):selected.length<limit?[...selected,id]:selected);
 const count=(node:QuestionChoice):number=>(node.id&&selected.includes(node.id)?1:0)+node.children.reduce((sum,n)=>sum+count(n),0);
 const expand=(key:string)=>setExpanded(previous=>{const next=new Set(previous);next.has(key)?next.delete(key):next.add(key);return next;});
 const row=(node:QuestionChoice,depth=0)=>{
  const children=node.children.length>0||!!node.anchors?.length,unfolded=!!needle||expanded.has(node.key),checked=selected.includes(node.id),blocked=disabled||disabledIds.includes(node.id)||(!checked&&selected.length>=limit);
  const title=<><small>{node.kind==='cross'?<><Network size={12}/>{node.code} · 同时关联 {node.anchors?.length||0} 个问题</>:node.code}</small><strong>{node.title}</strong></>;
  return <div key={node.key} data-question-choice={node.id||undefined} className={'question-choice-branch '+node.kind} style={{'--choice-depth':Math.min(depth,8)} as React.CSSProperties}>
   <div className={'question-choice-row'+(checked?' is-selected':'')} onClick={()=>{if(children)expand(node.key);}}>
    {children?<button type="button" className="question-choice-expand" aria-label={`${unfolded?'收起':'展开'}${node.title}`} aria-expanded={unfolded} onClick={e=>{e.stopPropagation();expand(node.key);}}><ChevronRight size={16}/></button>:<span className="question-choice-spacer"/>}
    {!!node.id&&<span className="question-choice-check" onClick={e=>e.stopPropagation()}><input type="checkbox" aria-label={`关联 ${node.code} · ${node.title}`} checked={checked} disabled={blocked} onChange={()=>toggle(node.id)}/></span>}
    {children?<button type="button" className="question-choice-title" aria-label={`${unfolded?'收起':'展开'} ${node.code} · ${node.title}`} aria-expanded={unfolded} onClick={e=>{e.stopPropagation();expand(node.key);}}>{title}</button>:<span className="question-choice-title">{title}</span>}
    {!!count(node)&&<span className="question-choice-count">已选 {count(node)}</span>}
   </div>
   {node.anchors&&unfolded&&<ul className="question-choice-anchors">{node.anchors.map(a=><li key={a.id}>{a.label}</li>)}</ul>}
   {children&&unfolded&&<div className="question-choice-children">{node.children.map(child=>row(child,depth+1))}</div>}
  </div>;
 };
 return <div className="question-link-picker"><button type="button" className="question-picker-trigger" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><ChevronRight size={16}/><span>所有关联问题</span><small>{selected.length?`已选 ${selected.length} 个`:'按主问题展开'}</small></button>{open&&<div className="question-picker-body"><label className="question-picker-search"><Search size={15}/><input aria-label="查找关联问题" placeholder="查找编号、标题或路径" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="question-picker-tree" tabIndex={0} aria-label="按主问题展开的关联问题">{shown.map(node=>row(node))}{!shown.length&&<p>没有匹配的问题</p>}</div></div>}{!!selected.length&&<div className="question-picker-selected" aria-label="已关联的问题">{selected.map(id=><button type="button" key={id} disabled={disabled} title={questionPath(data,id)} onClick={()=>toggle(id)}>{questionPath(data,id)}<span aria-hidden="true">×</span><span className="sr-only">取消关联</span></button>)}</div>}</div>;
}
