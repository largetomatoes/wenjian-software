import type {Notebook,LibraryBook} from './notebook';
import {displayBook} from './notebook';
import {folderForBook,normalizeLibraryFolders} from './library-folders';
import {libraryBooksForMode,zoteroCollectionTree,type LibraryMode} from './zotero';
import {noteBookIds} from './book-note-directory';
export type WritingFolder={id:string;name:string;children:WritingFolder[];bookIds:string[];directBookIds:string[]};
export type WritingLibraryPosition={bookId:string;folderId:string|null;expanded:string[]};
export type WritingBrowserPosition={source:LibraryMode;reading:WritingLibraryPosition;zotero:WritingLibraryPosition};
export const emptyLibraryPosition=():WritingLibraryPosition=>({bookId:'',folderId:null,expanded:[]});
export const emptyBrowserPosition=():WritingBrowserPosition=>({source:'reading',reading:emptyLibraryPosition(),zotero:emptyLibraryPosition()});
export const UNCLASSIFIED='@unclassified';
export function writingLibrary(data:Notebook,mode:LibraryMode){
 const books=libraryBooksForMode(data,mode).map(displayBook),ids=new Set(books.map(b=>b.id));
 let folders:WritingFolder[];
 if(mode==='zotero')folders=zoteroCollectionTree(data).map(function project(n):WritingFolder{return {id:n.id,name:n.name,children:n.children.map(project),bookIds:n.bookIds.filter(id=>ids.has(id)),directBookIds:n.directBookIds.filter(id=>ids.has(id))};});
 else folders=normalizeLibraryFolders(data.libraryFolders).map(f=>({id:'folder:'+f.id,name:f.name,children:[],bookIds:books.filter(b=>folderForBook(b,data.libraryFolders)===f.id).map(b=>b.id),directBookIds:books.filter(b=>folderForBook(b,data.libraryFolders)===f.id).map(b=>b.id)}));
 const flat:WritingFolder[]=[];for(const n of folders)flat.push(n);for(let i=0;i<flat.length;i++)flat.push(...flat[i].children);
 const classified=new Set(flat.flatMap(f=>f.directBookIds)),unclassified=books.filter(b=>!classified.has(b.id)).map(b=>b.id);
 if(unclassified.length)folders.push({id:UNCLASSIFIED,name:'未分类',children:[],bookIds:unclassified,directBookIds:unclassified});
 const nodes=new Map<string,WritingFolder>();const queue=[...folders];for(let i=0;i<queue.length;i++){nodes.set(queue[i].id,queue[i]);queue.push(...queue[i].children);}
 return {books,folders,nodes};
}
export function writingNoteIds(data:Notebook,mode:LibraryMode,bookId:string,folderId:string|null):Set<string>{
 if(bookId==='unfiled')return new Set(data.bookThoughts.filter(n=>!noteBookIds(n,data.libraryBooks).length).map(n=>n.id));
 const model=writingLibrary(data,mode),ids=new Set(bookId?[bookId]:folderId?model.nodes.get(folderId)?.bookIds||[]:model.books.map(b=>b.id));
 return new Set(data.bookThoughts.filter(n=>noteBookIds(n,data.libraryBooks).some(id=>ids.has(id))).map(n=>n.id));
}
export function restoreWritingBrowser(data:Notebook,value:unknown,legacyBookId=''):WritingBrowserPosition{
 const input=value&&typeof value==='object'?value as Partial<WritingBrowserPosition>:{};
 const source=input.source==='zotero'?'zotero':!input.source&&data.libraryBooks.some(b=>b.id===legacyBookId&&b.zotero)&&!libraryBooksForMode(data,'reading').some(b=>b.id===legacyBookId)?'zotero':'reading';
 const result=emptyBrowserPosition();result.source=source;
 for(const mode of ['reading','zotero'] as const){const model=writingLibrary(data,mode),raw=input[mode],fallback=mode===source?legacyBookId:'';
  const bookId=typeof raw?.bookId==='string'?raw.bookId:fallback;
  const selected=model.books.some(b=>b.id===bookId)||bookId==='unfiled'?bookId:'';
  const folderId=typeof raw?.folderId==='string'&&model.nodes.has(raw.folderId)?raw.folderId:null;
  const expanded=Array.isArray(raw?.expanded)?raw.expanded.filter((id):id is string=>typeof id==='string'&&model.nodes.has(id)):[];
  for(const node of model.nodes.values())if(selected&&node.bookIds.includes(selected)&&!expanded.includes(node.id))expanded.push(node.id);
  result[mode]={bookId:selected,folderId,expanded};
 }return result;
}
