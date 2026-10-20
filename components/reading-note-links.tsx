'use client';
import {QuestionLinkPicker} from './question-link-picker';
import {useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {type Notebook,type ReadingNote,recordLabel,crossNumber} from '@/lib/notebook';
export function ReadingNoteLinks({note,data,saving,save,onClose}:{note:ReadingNote;data:Notebook;saving:boolean;save:(data:Notebook,message:string)=>Promise<boolean>;onClose:()=>void}){
 const [ids,setIds]=useState(note.questionIds),[query,setQuery]=useState(''),[error,setError]=useState('');
 const locations=[...data.notes.filter(n=>n.kind==='question').map(n=>({id:n.id,label:`${n.parent?recordLabel(data,n.id):'核心问题'} · ${n.title}`})),...data.crossThoughts.map(c=>({id:c.id,label:`${crossNumber(c,data)} · ${c.title||c.text||'交叉思考'}`}))];
 async function commit(){setError('');const valid=new Set(locations.map(n=>n.id));if(await save({...data,readingNotes:data.readingNotes.map(n=>n.id===note.id?{...n,questionIds:ids.filter(id=>valid.has(id))}:n)},'过程笔记的关联已更新'))onClose();else setError('关联未保存，请重试。');}
 return <Dialog open onOpenChange={open=>{if(!open&&!saving)onClose();}}><DialogContent className="reading-links-dialog"><DialogTitle>关联问题</DialogTitle><DialogDescription>同一条过程笔记会出现在选中的问题中，原文仍留在书里。</DialogDescription><QuestionLinkPicker data={data} selected={ids} onChange={setIds} disabled={saving} initialOpen/>{error&&<p role="alert">{error}</p>}<footer><Button variant="ghost" disabled={saving} onClick={onClose}>取消</Button><Button disabled={saving} onClick={commit}>{saving?'保存中…':'保存关联'}</Button></footer></DialogContent></Dialog>;
}
