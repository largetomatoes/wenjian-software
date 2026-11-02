'use client';
import {useEffect} from 'react';
import {isRecordStorage} from '@/lib/record-transactions';
const pending=new Map<string,Promise<unknown>>();
export function usePageOcr(open:boolean,bookId:string|undefined,format:string|undefined,page:number){
 useEffect(()=>{
  if(!open||!bookId||format!=='pdf'||!isRecordStorage())return;
  let cancelled=false;
  for(const n of [page,page+1,...(page>1?[page-1]:[])]){
   const key=bookId+':'+n;let job=pending.get(key);
   if(!job){job=fetch('/api/architecture/ocr?bookId='+encodeURIComponent(bookId)+'&page='+n,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('识别缓存暂时未能读取。');return r.json();}).finally(()=>pending.delete(key));pending.set(key,job);}
   void job.then(value=>{const result=value as {entry?:unknown};if(!cancelled&&result.entry)window.dispatchEvent(new CustomEvent('wenjian:ocr-hydrated',{detail:result.entry}));}).catch(()=>{/* Existing on-page OCR and its persistent pending queue remain available. */});
  }
  return()=>{cancelled=true;};
 },[open,bookId,format,page]);
}
