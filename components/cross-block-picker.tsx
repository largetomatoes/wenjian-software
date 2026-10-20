"use client";
import {QuestionLinkPicker} from './question-link-picker';
import {useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {type Notebook,type CrossThought} from '@/lib/notebook';

export function CrossBlockPicker({data,editing,saving,error,onClose,onSave}:{data:Notebook;editing?:CrossThought;saving:boolean;error:string;onClose:()=>void;onSave:(title:string,ids:string[])=>Promise<void>}){
 const [ids,setIds]=useState<string[]>(editing?.anchorIds||[]);
 const [title,setTitle]=useState(editing?.title||'');
 const reaches=(from:string,target:string,seen=new Set<string>()):boolean=>{if(from===target)return true;if(seen.has(from))return false;seen.add(from);return data.crossThoughts.find(c=>c.id===from)?.anchorIds.some(id=>reaches(id,target,seen))||false;};
 const disabledIds=data.crossThoughts.filter(c=>!!editing&&(c.id===editing.id||reaches(c.id,editing.id))).map(c=>c.id);
 return <Dialog open onOpenChange={open=>{if(!open&&!saving)onClose();}}><DialogContent className="cross-dialog block-picker"><DialogTitle>{editing?'调整关联板块':'选择关联板块'}</DialogTitle><DialogDescription>选择两个或多个板块，上下级板块也可以同时选择。</DialogDescription>
 <QuestionLinkPicker data={data} selected={ids} onChange={setIds} disabled={saving} disabledIds={disabledIds} initialOpen/>

 {!editing&&<label className="block-title">交叉板块标题<Input value={title} onChange={e=>setTitle(e.target.value)} maxLength={300} placeholder="例如：语言与诚实"/></label>}
 {error&&<p className="error-banner" role="alert">{error}</p>}<div className="form-actions"><Button variant="ghost" disabled={saving} onClick={onClose}>取消</Button><Button disabled={saving||ids.length<2||(!editing&&!title.trim())} onClick={()=>void onSave(title.trim(),ids)}>{saving?'保存中…':editing?'保存关联':'进入笔记'}</Button></div></DialogContent></Dialog>;
}
