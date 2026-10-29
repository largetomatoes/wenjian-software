import type {BookThought,LibraryBook,Notebook} from './notebook';
import {noteBook,thoughtSources} from './book-notebook';
import {compositionOf,legacySources,snapshot,withComposition} from './reading-composition.cjs';

export function directoryTitle(note:BookThought):string {
 return note.composition?.title.trim()||(note.composition?.paper?.body||note.composition?.paragraphs.map(p=>p.text).join('\n')||note.text||'').trim().split(/\n/)[0].trim().slice(0,40)||'未命名笔记';
}
export function directoryPreview(note:BookThought):string {
 return (note.composition?.paper?.body||note.composition?.paragraphs.map(p=>p.text).join('\n')||note.text||'').replace(/\s+/g,' ').trim().slice(0,160);
}
export function noteBookIds(note:BookThought,books:LibraryBook[]):string[]{
 const known=new Set(books.map(b=>b.id));
 const ids=[note.libraryBookId,note.composition?.homeBookId,...thoughtSources(note).map(s=>s.libraryBookId)].filter((id):id is string=>!!id&&known.has(id));
 if(!ids.length&&!note.libraryBookId){const legacy=noteBook({kind:'reading',note},books);if(legacy)ids.push(legacy.id);}
 return [...new Set(ids)];
}
export function notesForBook(notes:BookThought[],bookId:string,books:LibraryBook[]):BookThought[]{
 return [...new Map(notes.filter(n=>noteBookIds(n,books).includes(bookId)).map(n=>[n.id,n])).values()];
}
export function recentBookNote(data:Notebook,bookId:string):BookThought|undefined{
 const notes=notesForBook(data.bookThoughts,bookId,data.libraryBooks),papers=notes.filter(n=>n.composition);
 return (papers.length?papers:notes).sort((a,b)=>(b.modifiedAt||b.at).localeCompare(a.modifiedAt||a.at))[0];
}
export function directoryChapters(note:BookThought,bookId?:string):string[] {
 return [...new Set([...(!bookId||note.libraryBookId===bookId?[note.chapter||'']:[]),...thoughtSources(note).filter(s=>!bookId||s.libraryBookId===bookId).map(s=>s.chapter||'')].map(s=>s.trim()).filter(Boolean))];
}
export function normalizeNoteTopics(value:readonly string[]):string[]{
 const topics:string[]=[];const seen=new Set<string>();
 for(const item of value){const label=item.trim();if(!label)continue;if(label.length>60)throw Error('每个主题请控制在 60 个字以内。');const key=label.toLocaleLowerCase();if(!seen.has(key)){seen.add(key);topics.push(label);}}
 if(topics.length>50)throw Error('一篇笔记最多添加 50 个主题。');return topics;
}
export function noteTopics(notes:BookThought[]):string[]{return normalizeNoteTopicsForCatalog(notes.flatMap(n=>n.tags||[]));}
function normalizeNoteTopicsForCatalog(value:string[]){const seen=new Set<string>();return value.filter(t=>{const key=t.toLocaleLowerCase();if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>a.localeCompare(b,'zh-CN'));}
export function withNoteTopics(note:BookThought,tags:readonly string[],at=new Date().toISOString()):BookThought{
 const next=normalizeNoteTopics(tags);
 if(JSON.stringify(next)===JSON.stringify(note.tags||[]))return note;
 return {...note,tags:next,modifiedAt:at,revisions:[...(note.revisions||[]),snapshot(note,at,'调整主题标签')]};
}
export function renameDirectoryNote(data:Notebook,bookId:string,noteId:string,title:string):Notebook {
 const note=data.bookThoughts.find(n=>n.id===noteId);if(!note)throw Error('这篇笔记已不在资料库中。');
 const value=title.trim();if(!value||value.length>500)throw Error('笔记标题请填写 1 至 500 个字。');
 const composition=compositionOf(note);if(!composition.homeBookId)composition.homeBookId=bookId;composition.title=value;
 const updated=withComposition(note,composition,legacySources(note),new Date().toISOString(),'修改笔记标题');
 return {...data,bookThoughts:data.bookThoughts.map(n=>n.id===noteId?updated:n)};
}
