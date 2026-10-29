'use client';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {visibleZoteroAnnotations,type Notebook,type LibraryBook,type BookThought,type BookThoughtSource,type ReadingComposition} from '@/lib/notebook';
import {attachSource,compositionOf,flattenComposition,legacySources,sourceNumbers,sourceIdentity,withComposition} from '@/lib/reading-composition.cjs';
import {readDraft,writeDraft} from '@/lib/draft-storage';
import {QuestionLinkPicker} from './question-link-picker';
import {readingZoteroSource} from '@/lib/reading-zotero-source';
import {rememberSourceChapters,processSources} from '@/lib/process-note-sources';
import './book-note-editor.css';
import {ReadingPaperEditor} from './reading-paper-editor';
import {paperOf,projectPaper,insertCitation,withAutoDisplays} from '@/lib/reading-paper.cjs';
export type ReadingEditorRequest={id:string;kind:'new'|'edit'|'source'|'paper'|'list';noteId?:string;paragraphId?:string;chapter?:string;source?:BookThoughtSource};
type Draft={note:BookThought;base:BookThought|null;paragraphId:string|null;dirty:boolean;version:number;caret?:number;viewMode?:'list'|'edit'};
type Props={book:LibraryBook;paneKey:string;data:Notebook;save:(n:Notebook,feedback:string,base?:Notebook)=>Promise<boolean>;request:ReadingEditorRequest|null;pendingSource?:BookThoughtSource|null;onConsumeSource?:()=>void;onRequestHandled?:(id:string)=>void;onNavigate:(source:BookThoughtSource)=>void;children:ReactNode};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const meaningful=(n:BookThought)=>!!(n.sources?.length||n.composition?.title.trim()||n.composition?.paragraphs.some(p=>p.text.trim()));
const when=(at:string)=>new Date(at).toLocaleString('zh-CN');
export function BookNoteEditor({book,paneKey,data,save,request,onNavigate,children,pendingSource,onConsumeSource,onRequestHandled}:Props){
 const [draft,setDraft]=useState<Draft|null>(null),[ready,setReady]=useState(false),[mode,setMode]=useState<'list'|'edit'>('list'),[error,setError]=useState(''),[status,setStatus]=useState(''),[history,setHistory]=useState(false),[picker,setPicker]=useState<string|null>(null),[sourceLimit,setSourceLimit]=useState(80),[query,setQuery]=useState(''),[reason,setReason]=useState('');
 const latest=useRef({data,save,book});latest.current={data,save,book};const current=useRef<Draft|null>(null),queue=useRef<Promise<void>>(Promise.resolve()),handled=useRef(''),composing=useRef(false),undo=useRef<Draft[]>([]),redo=useRef<Draft[]>([]),mounted=useRef(true),scroll=useRef<HTMLDivElement>(null);
 const paperCaret=useRef(0);
 const key='reading-composition:'+paneKey+':'+book.id;
 function prepared(n:BookThought){const sources=legacySources(n),composition=withAutoDisplays(compositionOf(n),sources);return {...n,composition,sources,text:flattenComposition(composition)};}
 function accept(d:Draft|null){paperCaret.current=d?.caret??(d?.note.composition?paperOf(d.note.composition,d.note.sources||[]).body.length:0);current.current=d;setDraft(d);}
 function fail(e:unknown){if(mounted.current){setError((e as Error).message);setStatus('保存失败');}}
 function enqueue(job:()=>Promise<void>){queue.current=queue.current.catch(()=>{}).then(job);return queue.current;}
 async function persist(){const d=current.current;if(d)await writeDraft(key,d);}
 async function commit(){const d=current.current;if(!d||!d.dirty||!meaningful(d.note))return;const captured=d.version;setStatus('保存中…');await writeDraft(key,d);
  const {data,save}=latest.current,existing=data.bookThoughts.find(n=>n.id===d.note.id);
  if(!same(existing||null,d.base))throw Error('这条笔记在另一处发生了修改，完整草稿已保留。请回到列表核对版本后再继续。');
  const c=d.note.composition!,sources=d.note.sources||[];const revised=d.base?withComposition(d.base,c,sources,undefined,reason):{...d.note,text:flattenComposition(c)};
  const next={...revised,questionIds:d.note.questionIds,chapter:d.note.chapter};
  // A question-link-only edit must also preserve a full prior state.
  if(d.base&&(!same(d.base.questionIds,next.questionIds)||d.base.chapter!==next.chapter)&&revised===d.base){const {snapshot}=await import('@/lib/reading-composition.cjs');next.revisions=[...(d.base.revisions||[]),snapshot(d.base,new Date().toISOString(),reason)];next.modifiedAt=new Date().toISOString();}
  if(!await save({...data,libraryBooks:rememberSourceChapters(data.libraryBooks,sources),bookThoughts:existing?data.bookThoughts.map(n=>n.id===next.id?next:n):[...data.bookThoughts,next]},'',data))throw Error('笔记尚未保存，草稿已保留；请稍后重试。');
  const live=current.current;if(live?.note.id===next.id){const updated=live.version===captured?{...live,note:next,base:next,dirty:false}:{...live,base:next};accept(updated);await writeDraft(key,updated);}
  if(mounted.current){setStatus('已保存 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}));setError('');}
 }
 async function flush(){await enqueue(async()=>{await persist();await commit();});}
 useEffect(()=>{mounted.current=true;let canceled=false;readDraft<Draft|null>(key,null).then(d=>{if(canceled)return;if(d){accept({...d,note:prepared(d.note)});setMode(d.viewMode||'edit');if(d.dirty)setStatus('草稿已恢复');}setReady(true);}).catch(fail);return()=>{canceled=true;mounted.current=false;const d=current.current;if(d)void writeDraft(key,d).catch(()=>{});};},[key]);
 useEffect(()=>{if(!ready||!draft?.dirty)return;const timer=setTimeout(()=>{void enqueue(persist).catch(fail);},300);const stable=setTimeout(()=>{if(!composing.current)void enqueue(commit).catch(fail);},1500);return()=>{clearTimeout(timer);clearTimeout(stable);};},[draft,ready,reason]);
 useEffect(()=>{const flushEvent=(e:Event)=>{(e as CustomEvent<{jobs:Promise<unknown>[]}>).detail.jobs.push(flush());};window.addEventListener('wenjian:flush-drafts',flushEvent);return()=>window.removeEventListener('wenjian:flush-drafts',flushEvent);});
 function blank(){const id=crypto.randomUUID(),paragraphId=crypto.randomUUID();return {note:{id,libraryBookId:book.id,bookTitle:book.title,scope:'book',locator:'',text:'',sources:[],composition:{schema:1,homeBookId:book.id,title:'',paragraphs:[{id:paragraphId,text:'',sourceIds:[]}],paper:{version:1,markerFormat:'square',body:'',citations:[],relations:[]}},questionIds:[],at:new Date().toISOString(),thoughts:[]} as BookThought,base:null,paragraphId,dirty:false,version:0};}
 function update(note:BookThought,paragraphId=current.current?.paragraphId||null){const old=current.current;if(!old)return;undo.current.push(old);if(undo.current.length>100)undo.current.shift();redo.current=[];accept({...old,note,paragraphId,dirty:true,version:old.version+1});setStatus('保存中…');setError('');}
 function documentChange(c:ReadingComposition,sources=current.current?.note.sources||[]){const old=current.current;if(old)update({...old.note,composition:c,sources,text:flattenComposition(c)});}
 async function start(req:ReadingEditorRequest){
  const active=current.current;
  if(req.kind==='new'||req.kind==='edit'&&req.noteId!==active?.note.id){await flush();if(req.kind==='edit'){const n=latest.current.data.bookThoughts.find(n=>n.id===req.noteId);if(!n)throw Error('这条笔记已不在当前列表。');accept({note:prepared(n),base:n,paragraphId:req.paragraphId||compositionOf(n).paragraphs[0]?.id||null,dirty:false,version:0});}else {const next=blank();next.note.chapter=req.chapter;accept(next);}undo.current=[];redo.current=[];}
  if(req.kind==='list'){await flush();if(current.current)current.current={...current.current,viewMode:'list'};setMode('list');return;}
  if(req.kind==='paper'&&!current.current)accept(blank());
  if(current.current)current.current={...current.current,viewMode:'edit'};setMode('edit');setHistory(false);
  if(req.kind==='source'&&req.source){if(!current.current)accept(blank());captureSource(req.source,paperCaret.current);}
  if(req.paragraphId){const d=current.current;if(d)accept({...d,paragraphId:req.paragraphId});requestAnimationFrame(()=>scroll.current?.querySelector<HTMLElement>('[data-paragraph-id="'+CSS.escape(req.paragraphId!)+'"]')?.scrollIntoView({block:'center'}));}
 }
 useEffect(()=>{if(!ready||!request||handled.current===request.id)return;handled.current=request.id;void start(request).then(()=>onRequestHandled?.(request.id)).catch(fail);},[ready,request]);
 function captureSource(source:BookThoughtSource,offset:number){const d=current.current;if(!d)throw Error('请先打开一张笔记板。');const attached=attachSource(d.note,source,d.paragraphId);const sources=attached.sources||[];const id=sources.find(s=>sourceIdentity(s)===sourceIdentity(source))!.id;const result=insertCitation(d.note.composition!,id,offset,sources);documentChange(result.composition,sources);paperCaret.current=result.caret;if(current.current)current.current={...current.current,caret:result.caret};onConsumeSource?.();return {caret:result.caret,citationId:result.citationId};}
 async function preserveConflict(action:'copy'|'current'){const d=current.current;if(!d)return;try{await enqueue(()=>writeDraft(key+':recovered:'+d.note.id+':'+Date.now(),d));if(action==='copy'){const note={...d.note,id:crypto.randomUUID(),at:new Date().toISOString(),modifiedAt:undefined,revisions:[],composition:{...d.note.composition!,title:(d.note.composition!.title||'阅读笔记')+'（草稿副本）'}};note.text=flattenComposition(note.composition);accept({...d,note,base:null,dirty:true,version:d.version+1});await flush();}else{const saved=latest.current.data.bookThoughts.find(n=>n.id===d.note.id);if(!saved)throw Error('当前记录已被移除，可以将草稿另存为新笔记。');accept({note:prepared(saved),base:saved,dirty:false,version:0,paragraphId:null});setError('');setStatus('已打开保存版本，先前草稿已另行保留');}}catch(e){fail(e);}}
 const conflictingRecord=draft&&error?data.bookThoughts.find(n=>n.id===draft.note.id):undefined;
 const n=draft?.note,c=n?.composition,numbers=c?sourceNumbers(c):new Map<string,number>();
 const catalog=useMemo<BookThoughtSource[]>(()=>[...(n?.sources||[]),...data.libraryHighlights.filter(h=>h.libraryBookId===book.id).map(h=>({...h,bookTitle:book.title,chapter:h.sourceLocation.startsWith('pdf:')?(book.pdfChapters||[]).filter(c=>c.startPage<=Number(h.sourceLocation.slice(4))).sort((a,b)=>b.startPage-a.startPage)[0]?.title:undefined,origin:{kind:'highlight' as const,highlightId:h.id}})),...data.readingNotes.flatMap(note=>processSources(note).filter(s=>s.libraryBookId===book.id).map(s=>({...s,readingNoteId:note.id,noteText:note.interpretation,origin:{kind:'process' as const,readingNoteId:note.id,sourceId:s.id}}))),...visibleZoteroAnnotations(book).filter(a=>a.text?.trim()).map(a=>readingZoteroSource(book,a))],[n?.sources,data.libraryHighlights,data.readingNotes,book]);
 const seen=new Set<string>(),available=catalog.filter(s=>{const id=sourceIdentity(s);if(seen.has(id))return false;seen.add(id);return !query||[s.quote,s.noteText,s.chapter,s.locator].join(' ').includes(query);});
 async function list(){try{await flush();if(current.current)current.current={...current.current,viewMode:'list'};setMode('list');}catch(e){fail(e);}}
 function changeHistory(direction:'undo'|'redo'){const from=direction==='undo'?undo:redo,to=direction==='undo'?redo:undo;if(!from.current.length||!current.current)return;to.current.push(current.current);const previous=from.current.pop()!;accept({...previous,base:current.current.base,dirty:true,version:current.current.version+1});}
 return <div className="reading-composition-workspace">
 <div className="reading-composition-nav"><button type="button" onClick={()=>mode==='edit'?void list():setMode('edit')} disabled={mode==='list'&&!n}>{mode==='edit'?'‹ 本书笔记':'继续写'}</button><button type="button" disabled={!ready} onClick={()=>void start({id:crypto.randomUUID(),kind:'new'}).catch(fail)}>＋ 新笔记板</button></div>
 {!ready&&<p role="status">读取草稿…</p>}{error&&<p className="composition-error" role="alert">{error}<button type="button" onClick={()=>void flush().catch(fail)}>重试保存</button></p>}
 {error&&draft?.dirty&&!same(conflictingRecord||null,draft.base)&&<div className="composition-local-conflict"><details><summary>核对另一处保存的版本</summary><p>{conflictingRecord?.text||'原记录已不在当前列表。'}</p></details><button type="button" onClick={()=>void preserveConflict('copy')}>把这份草稿另存为新笔记</button>{conflictingRecord&&<button type="button" onClick={()=>void preserveConflict('current')}>打开已保存版本，保留当前草稿副本</button>}</div>}
 {mode==='list'?children:c&&n&&<>
 <div className={"composition-writing"+(history?" is-history":"")} ref={scroll} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;void enqueue(persist).catch(fail);}}>
 <ReadingPaperEditor key={n.id} initialCaret={paperCaret.current} composition={c} sources={n.sources||[]} catalog={catalog} pendingSource={pendingSource} onChange={documentChange} onInsert={captureSource} onCaret={offset=>{paperCaret.current=offset;if(current.current)current.current={...current.current,caret:offset};}} onNavigate={onNavigate}/>
 {history&&<section className="composition-history"><h3>此前版本</h3>{[...(n.revisions||[])].reverse().map((v,i)=><details key={v.id||i}><summary>{when(v.at)}{v.reason?' · '+v.reason:''}</summary><p>{v.text}</p>{v.sources?.map(s=><blockquote key={s.id}>{s.locator} · {s.quote}</blockquote>)}<button type="button" onClick={()=>{const old={...n,...v,id:n.id,composition:v.composition,sources:v.composition?v.sources:v.sources?.length?v.sources:undefined};const originalComposition=compositionOf(old),restored=withAutoDisplays(projectPaper(originalComposition,paperOf(originalComposition,legacySources(old)),legacySources(old)),legacySources(old));update({...n,composition:restored,sources:legacySources(old),text:flattenComposition(restored),chapter:v.chapter,questionIds:(v.questionIds||[]).filter(id=>data.notes.some(q=>q.kind==='question'&&q.id===id)||data.crossThoughts.some(q=>q.id===id))});setReason('恢复 '+when(v.at)+' 的版本');setHistory(false);}}>恢复此版并保留当前版本</button></details>)}{!n.revisions?.length&&<p>实际修改后，这里会保留此前的表述和引用。</p>}</section>}
 </div>
 <footer className="composition-footer"><span role="status">{status||'尚未修改'}<small>{when(n.at)}</small></span><details><summary>关联问题{n.questionIds.length?' · '+n.questionIds.length:''}</summary><QuestionLinkPicker data={data} selected={n.questionIds} onChange={ids=>update({...n,questionIds:ids})}/></details><details><summary aria-label="阅读笔记更多操作">···</summary><div><button type="button" disabled={!undo.current.length} onClick={()=>changeHistory('undo')}>撤销</button><button type="button" disabled={!redo.current.length} onClick={()=>changeHistory('redo')}>重做</button><button type="button" onClick={()=>setHistory(v=>!v)}>修改记录</button><input aria-label="阅读笔记修改原因" value={reason} placeholder="修改原因（选填）" onChange={e=>setReason(e.target.value)}/></div></details></footer>
 </>}
 </div>;
}
