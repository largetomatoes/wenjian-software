import type {Notebook,LibraryBook} from './notebook';
// null means the request also edits content/metadata and needs the complete save path.
export function readingProgressDelta(before:Notebook,after:Notebook):Array<{id:string;progress:LibraryBook['progress']}>|null{
 const keys=new Set([...Object.keys(before),...Object.keys(after)]);
 if([...keys].some(key=>key!=='libraryBooks'&&before[key as keyof Notebook]!==after[key as keyof Notebook]))return null;
 if(before.libraryBooks.length!==after.libraryBooks.length)return null;
 const items:Array<{id:string;progress:LibraryBook['progress']}>=[];
 for(let i=0;i<after.libraryBooks.length;i++){
  const old=before.libraryBooks[i],book=after.libraryBooks[i];
  if(old.id!==book.id)return null;
  const fields=new Set([...Object.keys(old),...Object.keys(book)]);
  if([...fields].some(key=>key!=='progress'&&old[key as keyof LibraryBook]!==book[key as keyof LibraryBook]))return null;
  const progress=Object.fromEntries(Object.entries(book.progress).filter(([key,value])=>value!==old.progress[key as keyof LibraryBook['progress']]));
  if(Object.keys(old.progress).some(key=>!(key in book.progress)))return null;
  if(Object.values(progress).some(value=>value===undefined))return null;
  if(Object.keys(progress).length)items.push({id:book.id,progress});
 }
 return items;
}
