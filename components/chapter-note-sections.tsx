'use client';
import {useState,type ReactNode} from 'react';
import {ChevronRight,Plus} from 'lucide-react';
import type {BookNote,ChapterNotes} from '@/lib/book-notebook';
import './chapter-notes.css';
import {ReaderNoteSlot} from './reader-note-slot';
import {isOptimizedReader} from '@/lib/reader-performance';

function Chapter({group,renderNote,onAdd,focusId,expandKey,virtualized=false}:{virtualized?:boolean;group:ChapterNotes;renderNote:(entry:BookNote)=>ReactNode;onAdd?:(chapter:string)=>void;focusId?:string|null;expandKey?:string}){
 const focus=focusId&&group.entries.some(entry=>entry.note.id===focusId)?focusId:null;
 const [state,setState]=useState(()=>({open:!!focus||!!expandKey,visited:!!focus||!!expandKey,focus,expandKey}));
 if(state.focus!==focus||state.expandKey!==expandKey){const reveal=!!focus&&state.focus!==focus||!!expandKey&&state.expandKey!==expandKey;setState({...state,focus,expandKey,open:state.open||reveal,visited:state.visited||reveal});}
 // Keep an opened editor mounted when its chapter is folded again.
 const {open,visited}=state;
 return <details className="chapter-note-group" open={open} onToggle={event=>{const next=event.currentTarget.open;setState(current=>({...current,open:next,visited:current.visited||next}));}} data-chapter={group.title}><summary><ChevronRight size={16}/><strong>{group.title}</strong><span>{group.entries.length}</span></summary>{(open||visited)&&<div className="chapter-note-body">{onAdd&&group.key!=='unfiled'&&<button className="chapter-add-note" type="button" onClick={()=>onAdd(group.chapter)}><Plus size={14}/>在{group.key==='whole'?'全书':'本章'}写思考</button>}{group.entries.map(entry=>virtualized?<ReaderNoteSlot key={entry.kind+':'+entry.note.id+('source' in entry?':'+entry.source?.id:'')} id={entry.note.id} pinned={focusId===entry.note.id} render={()=>renderNote(entry)}/>:renderNote(entry))}{!group.entries.length&&<p className="chapter-empty">这一章还没有笔记。</p>}</div>}</details>;
}
export function ChapterNoteSections({groups,renderNote,onAdd,focusId,expandKey}:{groups:ChapterNotes[];renderNote:(entry:BookNote)=>ReactNode;onAdd?:(chapter:string)=>void;focusId?:string|null;expandKey?:string}){
 const virtualized=isOptimizedReader()&&groups.reduce((sum,group)=>sum+group.entries.length,0)>120;
 return <div className="chapter-note-sections">{groups.map(group=><Chapter key={group.key} group={group} virtualized={virtualized} renderNote={renderNote} onAdd={onAdd} focusId={focusId} expandKey={expandKey}/>)}{!groups.length&&<p className="chapter-empty">还没有笔记，可以先留下一个想法。</p>}</div>;
}
