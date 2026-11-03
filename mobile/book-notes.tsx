import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronRight} from 'lucide-react';
import {BookNoteDirectory,BookNoteAuxiliary} from '../components/book-note-directory';
import {BookNoteEditor,type ReadingEditorRequest} from '../components/book-note-editor';
import {ChapterNoteSections} from '../components/chapter-note-sections';
import {Dialog,DialogContent,DialogTitle} from '../components/ui/dialog';
import {chapterNotes,notebookBooks} from '../lib/book-notebook';
import {directoryTitle,noteBookIds} from '../lib/book-note-directory';
import {crossNumber,numberOf,displayBook,type BookThought,type LibraryBook,type Notebook} from '../lib/notebook';
import {WritingBookBrowser} from '../components/writing-book-browser';
import {emptyBrowserPosition,restoreWritingBrowser,writingNoteIds,writingLibrary,type WritingBrowserPosition} from '../lib/writing-library';
import {readDraft,writeDraft} from '../lib/draft-storage';
import {flushEditors} from '../lib/flush-editors';

export function MobileBookNotes({data,save,onQuestion,onBook}:{data:Notebook;save:(next:Notebook,message:string,base?:Notebook)=>Promise<boolean>;onQuestion:(id:string)=>void;onBook:(id:string,location?:string,readingId?:string,thoughtId?:string,chapter?:string)=>void}){
 const [query,setQuery]=useState(''),[browser,setBrowser]=useState<WritingBrowserPosition>(emptyBrowserPosition),[ready,setReady]=useState(false),[browse,setBrowse]=useState(false);
 const [detached,setDetached]=useState<{book:LibraryBook;request:ReadingEditorRequest}|null>(null),[error,setError]=useState('');
 const POSITION='mobile-note-lookup:browser',browserRef=useRef(browser),readyRef=useRef(false);browserRef.current=browser;readyRef.current=ready;
 useEffect(()=>()=>{if(readyRef.current)void writeDraft(POSITION,browserRef.current).catch(()=>{});},[]);
 useEffect(()=>{let canceled=false;void readDraft(POSITION,null).then(saved=>{if(!canceled){setBrowser(restoreWritingBrowser(data,saved));setReady(true);}}).catch(()=>setReady(true));return()=>{canceled=true;};},[]);
 useEffect(()=>{if(!ready)return;const timer=setTimeout(()=>void writeDraft(POSITION,browser).catch(()=>{}),250);const flush=(event:Event)=>(event as CustomEvent<{jobs:Promise<unknown>[]}>).detail.jobs.push(writeDraft(POSITION,browser));window.addEventListener('wenjian:flush-drafts',flush);return()=>{clearTimeout(timer);window.removeEventListener('wenjian:flush-drafts',flush);};},[ready,browser]);
 const position=browser[browser.source],model=useMemo(()=>writingLibrary(data,browser.source),[data.libraryBooks,data.libraryFolders,data.zoteroCollections,browser.source]);
 const noteIds=useMemo(()=>writingNoteIds(data,browser.source,position.bookId,position.folderId),[data.bookThoughts,data.libraryBooks,data.libraryFolders,data.zoteroCollections,browser.source,position.bookId,position.folderId]);
 const books=useMemo(()=>notebookBooks(data),[data]);
 const label=(id:string)=>{const question=data.notes.find(note=>note.id===id);if(question)return `${question.parent?numberOf(question,data.notes,data.crossThoughts):'核心问题'} · ${question.title}`;const cross=data.crossThoughts.find(item=>item.id===id);return cross?`${crossNumber(cross)} · ${cross.title||cross.text}`:'已移除的问题';};
 const needle=query.trim().toLocaleLowerCase(),group=model.nodes.get(position.folderId||'');
 const allowedBooks=new Set(position.bookId&&position.bookId!=='unfiled'?[position.bookId]:group?.bookIds||model.books.map(b=>b.id));
 const visible=books.filter(book=>position.bookId==='unfiled'?!book.book:!!book.book&&allowedBooks.has(book.book.id)).map(book=>({...book,entries:book.entries.filter(entry=>entry.kind==='process'&&(!needle||[book.title,entry.note.chapter,entry.note.quote,entry.note.interpretation,entry.note.locator,...entry.note.thoughts.map(t=>t.text)].filter(Boolean).join('\n').toLocaleLowerCase().includes(needle)))})).filter(book=>book.entries.length);
 function pickBook(id:string){setBrowser(old=>restoreWritingBrowser(data,{...old,[old.source]:{...old[old.source],bookId:id}}));setBrowse(false);}
 function openNote(note:BookThought,contextBookId?:string){
  const ids=noteBookIds(note,data.libraryBooks),target=contextBookId&&ids.includes(contextBookId)?contextBookId:ids[0];
  if(target){onBook(target,undefined,undefined,note.id);return;}
  const id=note.composition?.homeBookId||note.libraryBookId||'detached:'+note.id;
  setError('');setDetached({book:{id,title:note.bookTitle||'未归属书目',author:'',format:'reference',storedFile:'',originalName:'',addedAt:note.at,progress:{}},request:{id:crypto.randomUUID(),kind:'edit',noteId:note.id}});
 }
 async function closeDetached(){try{await flushEditors();setDetached(null);setError('');}catch(e){setError((e as Error).message);}}
 const detachedNote=detached?data.bookThoughts.find(n=>n.id===detached.request.noteId):undefined;
 const bookTitle=position.bookId==='unfiled'?'未归属书目':data.libraryBooks.find(b=>b.id===position.bookId);
 return <section className="mobile-note-lookup"><details className="mobile-note-browser" open={browse} onToggle={e=>setBrowse(e.currentTarget.open)}><summary>书目 · {typeof bookTitle==='string'?bookTitle:bookTitle?displayBook(bookTitle).title:group?.name||(browser.source==='reading'?'读书':'Zotero')}</summary>{browse&&<WritingBookBrowser data={data} value={browser} onSource={source=>setBrowser(old=>({...old,source}))} onBook={pickBook} onFolder={folderId=>{setBrowser(old=>({...old,[old.source]:{...old[old.source],bookId:'',folderId,expanded:folderId?[...new Set([...old[old.source].expanded,folderId])]:old[old.source].expanded}}));setBrowse(false);}} onExpand={(id,open)=>setBrowser(old=>({...old,[old.source]:{...old[old.source],expanded:open?[...new Set([...old[old.source].expanded,id])]:old[old.source].expanded.filter(v=>v!==id)}}))}/>}</details>
 <BookNoteDirectory showBookFilter={false} selectedBookId={position.bookId==='unfiled'?'':position.bookId} noteIds={noteIds} scopeLabel={position.bookId==='unfiled'?'未归属书目':position.bookId?'本书笔记':group?.name||(browser.source==='reading'?'全部读书':'全部文献')} data={data} query={query} onQuery={setQuery} save={save} onOpen={openNote} auxiliary={<BookNoteAuxiliary title="摘录与过程笔记 · 按来源章节浏览"><section className="mobile-notes" aria-label="分书分章节过程笔记">{visible.map(book=><details className="mobile-note-book" key={book.key} open={needle?true:undefined}><summary><ChevronRight size={17}/><div><strong>{book.title}</strong><small>{book.author||(!book.book?'原文件未在书库中':'')} · {book.entries.length} 条过程笔记</small></div></summary><ChapterNoteSections groups={chapterNotes(book.entries,book.book)} expandKey={needle} renderNote={item=>{if(item.kind!=='process')return null;const note=item.note;return <article key={note.id}><header><span>过程笔记 · {note.locator}</span><time>{new Date(note.at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</time></header>{note.quote&&<blockquote>{note.quote}</blockquote>}<p>{note.interpretation}</p>{!!note.questionIds.length&&<div className="book-thought-links">{note.questionIds.map(id=><button key={id} onClick={()=>onQuestion(id)}>{label(id)}</button>)}</div>}{note.thoughts.map(thought=><aside key={thought.id}><small>{new Date(thought.at).toLocaleString('zh-CN')} · {thought.origin}</small><p>{thought.text}</p>{thought.reason&&<em>修改原因：{thought.reason}</em>}</aside>)}{book.book&&<footer><button onClick={()=>onBook(book.book!.id,note.sourceLocation,note.id)}>回到原文</button></footer>}</article>;}}/></details>)}{!visible.length&&<p className="mobile-empty">{needle?'没有匹配的过程笔记。':'阅读时留下的摘录和注解会保留在这里。'}</p>}</section></BookNoteAuxiliary>}/>
 {detached&&<Dialog open onOpenChange={open=>{if(!open)void closeDetached();}}><DialogContent className="mobile-detached-note" aria-describedby={undefined}><DialogTitle>{detachedNote?directoryTitle(detachedNote):'阅读笔记'}</DialogTitle>{error&&<p role="alert">{error}</p>}<BookNoteEditor isOpen key={detached.book.id} book={detached.book} paneKey="library" data={data} save={save} request={detached.request} onNavigate={source=>{if(source.libraryBookId&&data.libraryBooks.some(b=>b.id===source.libraryBookId))void flushEditors().then(()=>{setDetached(null);onBook(source.libraryBookId!,source.sourceLocation,undefined,detached.request.noteId);}).catch(e=>setError(e.message));else setError('原书暂不可用，摘录与笔记仍保留在这里。');}}><></></BookNoteEditor></DialogContent></Dialog>}
 </section>;
}
