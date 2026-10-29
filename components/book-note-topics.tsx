'use client';
import {useState} from 'react';
import {Plus,X} from 'lucide-react';
import {normalizeNoteTopics} from '@/lib/book-note-directory';
export function BookNoteTopics({value,suggestions,onChange,disabled=false}:{value:string[];suggestions:string[];onChange:(tags:string[])=>void;disabled?:boolean}){
 const [text,setText]=useState(''),[error,setError]=useState('');
 function add(label=text){try{const next=normalizeNoteTopics([...value,label]);onChange(next);setText('');setError('');}catch(e){setError((e as Error).message);}}
 const available=suggestions.filter(t=>!value.some(v=>v.toLocaleLowerCase()===t.toLocaleLowerCase())&&(!text.trim()||t.toLocaleLowerCase().includes(text.trim().toLocaleLowerCase()))).slice(0,12);
 return <div className="book-note-topics" aria-label="笔记主题"><div className="note-topic-current">{value.map(t=><span key={t}>{t}<button type="button" disabled={disabled} aria-label={'移除主题 '+t} onClick={()=>onChange(value.filter(v=>v!==t))}><X size={12}/></button></span>)}</div><div className="note-topic-add"><input aria-label="添加笔记主题" placeholder="输入自己的主题，回车添加" value={text} maxLength={60} disabled={disabled} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();if(text.trim())add();}}}/><button type="button" disabled={disabled||!text.trim()} aria-label="确认添加主题" onClick={()=>add()}><Plus size={14}/></button></div>{error&&<p role="alert">{error}</p>}{available.length>0&&<div className="note-topic-suggestions">{available.map(t=><button type="button" disabled={disabled} key={t} onClick={()=>add(t)}>{t}</button>)}</div>}</div>;
}
