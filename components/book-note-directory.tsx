'use client';
import {useDeferredValue,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {ChevronDown,ChevronRight,MoreHorizontal,Search} from 'lucide-react';
import {displayBook,type BookThought,type LibraryBook,type Notebook} from '@/lib/notebook';
import {directoryChapters,directoryPreview,directoryTitle,noteBookIds,noteTopics,renameDirectoryNote,withNoteTopics} from '@/lib/book-note-directory';
import {BookNoteTopics} from './book-note-topics';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger} from './ui/dropdown-menu';
import './book-note-directory.css';

type Props={auxiliary?:ReactNode;book:LibraryBook;data:Notebook;query:string;onQuery:(q:string)=>void;onOpen:(note:BookThought,bookId?:string)=>void;focusId?:string|null;save:(next:Notebook,message:string,base?:Notebook)=>Promise<boolean>};
type Edit={kind:'title'|'topics';id:string;value:string;tags:string[]};
const date=(v:string)=>new Date(v).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
export function BookNoteDirectory(props:Props){
 const {book,data,query,onQuery,onOpen,focusId}=props,latest=useRef(props);latest.current=props;
 const [bookId,setBookId]=useState(book.id),[topics,setTopics]=useState<string[]>([]),[chapter,setChapter]=useState(''),[limit,setLimit]=useState(60),[edit,setEdit]=useState<Edit|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const deferred=useDeferredValue(query),vocabulary=useMemo(()=>noteTopics(data.bookThoughts),[data.bookThoughts]);
 useEffect(()=>{setBookId(book.id);setChapter('');setTopics([]);},[book.id]);
 useEffect(()=>setLimit(60),[bookId,topics,chapter,deferred]);
 const books=useMemo(()=>new Map(data.libraryBooks.map(b=>[b.id,displayBook(b)])),[data.libraryBooks]);
 const all=useMemo(()=>[...new Map(data.bookThoughts.map(n=>[n.id,n])).values()].sort((a,b)=>(b.modifiedAt||b.at).localeCompare(a.modifiedAt||a.at)),[data.bookThoughts]);
 const index=useMemo(()=>new Map(all.map(n=>[n.id,{books:noteBookIds(n,data.libraryBooks),text:[directoryTitle(n),n.text,...(n.tags||[]),...(n.thoughts||[]).map(t=>t.text),...(n.sources||[]).flatMap(s=>[s.bookTitle,s.quote,s.chapter,s.noteText])].join('\n').toLocaleLowerCase()}])),[all,data.libraryBooks]);
 const scoped=useMemo(()=>all.filter(n=>!bookId||index.get(n.id)!.books.includes(bookId)),[all,index,bookId]);
 const chapters=useMemo(()=>[...new Set(scoped.flatMap(n=>directoryChapters(n,bookId||undefined)))],[scoped,bookId]);
 const rows=useMemo(()=>scoped.filter(n=>(!deferred.trim()||index.get(n.id)!.text.includes(deferred.trim().toLocaleLowerCase()))&&topics.every(t=>(n.tags||[]).some(v=>v.toLocaleLowerCase()===t.toLocaleLowerCase()))&&(!chapter||directoryChapters(n,bookId||undefined).includes(chapter))),[scoped,index,deferred,topics,chapter,bookId]);
 async function commit(event:React.FormEvent){event.preventDefault();if(!edit||busy)return;setBusy(true);setError('');try{const p=latest.current,record=p.data.bookThoughts.find(n=>n.id===edit.id);if(!record)throw Error('这篇笔记已不在资料库中。');const next=edit.kind==='title'?renameDirectoryNote(p.data,record.libraryBookId||book.id,record.id,edit.value):{...p.data,bookThoughts:p.data.bookThoughts.map(n=>n.id===record.id?withNoteTopics(n,edit.tags):n)};if(!await p.save(next,'',p.data))throw Error('这次修改尚未保存，请重试；原笔记仍保留。');setEdit(null);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="book-note-directory" aria-label="查找笔记">
  <label className="note-lookup-search"><Search size={16}/><input autoComplete="off" aria-label="搜索笔记" placeholder="搜索标题、正文、摘录或主题" value={query} onChange={e=>onQuery(e.target.value)}/></label>
  <div className="note-lookup-facets"><label>书目<select aria-label="按书目查找笔记" value={bookId} onChange={e=>{setBookId(e.target.value);setChapter('');}}><option value="">全部书目</option>{data.libraryBooks.map(b=><option key={b.id} value={b.id}>{displayBook(b).title}</option>)}</select></label><details className="note-topic-filter"><summary>主题{topics.length?' · '+topics.length:''}<ChevronDown size={13}/></summary><div>{vocabulary.length?vocabulary.map(t=><label key={t}><input type="checkbox" checked={topics.includes(t)} onChange={e=>setTopics(e.target.checked?[...topics,t]:topics.filter(v=>v!==t))}/>{t}</label>):<p>可以在写作区为笔记添加自己的主题。</p>}</div></details><details className="note-chapter-filter"><summary>更多筛选<ChevronDown size={13}/></summary><label>来源章节<select aria-label="按来源章节筛选笔记" value={chapter} onChange={e=>setChapter(e.target.value)}><option value="">全部章节</option>{chapters.map(c=><option key={c}>{c}</option>)}</select></label></details></div>
  {topics.length>0&&<div className="note-lookup-selected">{topics.map(t=><button type="button" key={t} onClick={()=>setTopics(topics.filter(v=>v!==t))}>{t} ×</button>)}</div>}
  {error&&<p role="alert" className="note-lookup-error">{error}</p>}
  {edit&&<form className="note-lookup-edit" onSubmit={commit}>{edit.kind==='title'?<label>修改标题<input autoFocus aria-label="新的笔记标题" maxLength={500} value={edit.value} onChange={e=>setEdit({...edit,value:e.target.value})}/></label>:<BookNoteTopics value={edit.tags} suggestions={vocabulary} onChange={tags=>setEdit({...edit,tags})}/>}<div><button type="button" onClick={()=>setEdit(null)}>取消</button><button type="submit" disabled={busy||edit.kind==='title'&&!edit.value.trim()}>保存</button></div></form>}
  <div className="note-lookup-count">{bookId===book.id?'本书笔记':bookId?'所选书目':'全部书目'} · {rows.length} 篇</div>
  <div className="note-lookup-results" aria-label="笔记查询结果">{rows.slice(0,limit).map(n=><article key={n.id} data-directory-note={n.id} className={focusId===n.id?'is-focused':''}><button type="button" className="note-lookup-open" onClick={()=>onOpen(n,bookId||undefined)}><strong>{directoryTitle(n)}</strong><p>{directoryPreview(n)||'还没有正文'}</p><small><span>{index.get(n.id)!.books.map(id=>books.get(id)?.title).filter(Boolean).join(' · ')||'未归属书目'}</span><time dateTime={n.modifiedAt||n.at}>{date(n.modifiedAt||n.at)}</time></small>{!!n.tags?.length&&<div className="note-lookup-tags">{n.tags.slice(0,3).map(t=><span key={t}>{t}</span>)}{n.tags.length>3&&<span>＋{n.tags.length-3}</span>}</div>}</button><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="note-lookup-menu" aria-label={'整理笔记 '+directoryTitle(n)}><MoreHorizontal size={16}/></button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={()=>setEdit({kind:'title',id:n.id,value:n.composition?.title||'',tags:n.tags||[]})}>修改标题</DropdownMenuItem><DropdownMenuItem onSelect={()=>setEdit({kind:'topics',id:n.id,value:'',tags:n.tags||[]})}>设置主题</DropdownMenuItem></DropdownMenuContent></DropdownMenu></article>)}</div>
  {!rows.length&&<p className="note-lookup-empty">{query||topics.length||chapter?'没有匹配的笔记，可以调整书目或筛选条件。':'还没有笔记，返回写作即可开始。'}</p>}
  {rows.length>limit&&<button type="button" className="note-lookup-more" onClick={()=>setLimit(n=>n+60)}>显示更多 · 还有 {rows.length-limit} 篇</button>}
  <div className="note-lookup-secondary">{props.auxiliary}</div>
 </section>;
}
export function BookNoteAuxiliary({title,children,focusToken}:{title:string;children:ReactNode;focusToken?:string|null}){
 const [state,setState]=useState({open:false,visited:false});
 useEffect(()=>{if(focusToken)setState({open:true,visited:true});},[focusToken]);
 return <details className="book-note-auxiliary" open={state.open} onToggle={e=>{const open=e.currentTarget.open;setState(s=>s.open===open?s:{open,visited:s.visited||open});}}><summary><ChevronRight size={14}/>{title}</summary>{state.visited&&<div>{children}</div>}</details>;
}
