import {useMemo,useRef} from 'react';
import type {LibraryBook} from '@/lib/notebook';
// Progress is saved frequently; it must not invalidate the chapter/note index.
export function useBookMetadata(books:LibraryBook[]){
 const previous=useRef<LibraryBook[]>([]);
 return useMemo(()=>{
  const old=new Map(previous.current.map(book=>[book.id,book]));
  const next=books.map(book=>{const {progress,...metadata}=book,prior=old.get(book.id);if(prior){const keys=Object.keys(metadata) as (keyof typeof metadata)[];if(keys.length===Object.keys(prior).length-1&&keys.every(key=>metadata[key]===prior[key]))return prior;}return {...metadata,progress:{}} as LibraryBook;});
  if(next.length!==previous.current.length||next.some((book,i)=>book!==previous.current[i]))previous.current=next;
  return previous.current;
 },[books]);
}
