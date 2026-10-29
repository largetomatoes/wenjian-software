import type {LibraryBook,ZoteroAnnotation,BookThoughtSource} from './notebook';
import {zoteroCfi} from './zotero-position';
export function readingZoteroSource(book:LibraryBook,a:ZoteroAnnotation):BookThoughtSource{
 let page=a.page;try{const p=JSON.parse(a.position||'{}');if(!page&&Number.isInteger(p.pageIndex))page=p.pageIndex+1;}catch{}
 return {id:'zotero:'+book.zotero?.serverId+':'+a.attachmentKey+':'+a.key,libraryBookId:book.id,bookTitle:book.title,author:book.author,quote:a.text,noteText:a.comment,zoteroPosition:a.position,locator:a.pageLabel?'第 '+a.pageLabel+' 页':page?'第 '+page+' 页':'Zotero 批注',chapter:book.format==='pdf'&&page?(book.pdfChapters||[]).filter(c=>c.startPage<=page!).sort((a,b)=>b.startPage-a.startPage)[0]?.title:undefined,sourceLocation:book.format==='pdf'&&page?'pdf:'+page:book.format==='epub'&&zoteroCfi(a)||'zotero:'+a.key,origin:{kind:'zotero',serverId:book.zotero!.serverId,library:book.zotero!.library,itemKey:book.zotero!.itemKey,attachmentKey:a.attachmentKey,annotationKey:a.key}};
}
