// Shared by renderer, local persistence and sync. No DOM or mutable global state.
'use strict';
const {flattenPaper,validatePaper}=require('./reading-paper.cjs');
const clone=value=>JSON.parse(JSON.stringify(value));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function sourceIdentity(s){
 const o=s.origin;
 if(o&&o.kind!=='selection')return JSON.stringify([s.libraryBookId,o]);
 const rect=r=>[r.x,r.y,r.width,r.height].map(v=>Math.round(v*1000000)/1000000),geometry=s.pdfSegments?.length?s.pdfSegments.map(p=>[p.page,p.rects?.map(rect)]):s.rects?.length?s.rects.map(rect):typeof s.anchorY==='number'?Math.round(s.anchorY*1000000)/1000000:null;
 const anchored=geometry!==null||s.sourceLocation?.startsWith('epubcfi(');return JSON.stringify([s.libraryBookId,s.sourceLocation,geometry,anchored?null:s.rawQuote||s.quote,s.readingNoteId]);
}
function legacySources(n){return n.sources!==undefined?n.sources:n.quote?[{id:'legacy:'+n.id,libraryBookId:n.libraryBookId,bookTitle:n.bookTitle,chapter:n.chapter,locator:n.locator,sourceLocation:n.sourceLocation,quote:n.quote,rawQuote:n.rawQuote,pdfSegments:n.pdfSegments}]:[];}
function compositionOf(n){return n.composition?clone(n.composition):{schema:1,homeBookId:n.libraryBookId||legacySources(n)[0]?.libraryBookId||'',title:'',paragraphs:[{id:'paragraph:'+n.id,text:n.text,sourceIds:legacySources(n).map(s=>s.id)}]};}
function sourceNumbers(c){const ids=[...new Set(c.paragraphs.flatMap(p=>p.sourceIds))];return new Map(ids.map((id,i)=>[id,i+1]));}
function flattenComposition(c){if(c.paper)return flattenPaper(c);const numbers=sourceNumbers(c);return [c.title?.trim(),...c.paragraphs.map(p=>p.text+(p.sourceIds.length?' '+p.sourceIds.map(id=>'〔'+numbers.get(id)+'〕').join(''):''))].filter(Boolean).join('\n\n');}
function validateComposition(n){
 const c=n.composition;if(!c)return '';
 if(c.schema!==1||typeof c.homeBookId!=='string'||!c.homeBookId||typeof c.title!=='string'||c.title.length>500||!Array.isArray(c.paragraphs)||!c.paragraphs.length||c.paragraphs.length>2000)return '读书笔记文档格式不正确。';
 const ss=n.sources;if(!Array.isArray(ss)||ss.length>1000||ss.some(s=>!s||typeof s.id!=='string'||!s.id)||new Set(ss.map(s=>s.id)).size!==ss.length)return '读书笔记来源池不正确。';
 const paperError=validatePaper(c,ss);if(paperError)return paperError;
 const ids=new Set(ss.map(s=>s.id));if(c.paragraphs.some(p=>!p||typeof p.id!=='string'||!p.id))return '思考段编号缺失。';if(new Set(c.paragraphs.map(p=>p.id)).size!==c.paragraphs.length)return '思考段编号重复。';
 if(c.paragraphs.some(p=>!p.id||typeof p.text!=='string'||!Array.isArray(p.sourceIds)||new Set(p.sourceIds).size!==p.sourceIds.length||p.sourceIds.some(id=>!ids.has(id))))return '思考段引用了不存在的来源。';
 if(n.text!==flattenComposition(c))return '此笔记的正文与段落引用不一致，请保留草稿并使用新版编辑器。';
 if(n.libraryBookId&&n.libraryBookId!==c.homeBookId)return '笔记归属需要保留。';
 return '';
}
function snapshot(n,at,reason=''){return {id:globalThis.crypto.randomUUID(),text:n.text,sources:clone(n.sources||[]),questionIds:[...n.questionIds],...(n.composition?{composition:clone(n.composition)}:{}),libraryBookId:n.libraryBookId,bookTitle:n.bookTitle,chapter:n.chapter,locator:n.locator,sourceLocation:n.sourceLocation,quote:n.quote,rawQuote:n.rawQuote,pdfSegments:n.pdfSegments,scope:n.scope,at,reason};}
function withComposition(n,c,sources,at=new Date().toISOString(),reason=''){
 const next={...n,composition:clone(c),sources:clone(sources),libraryBookId:c.homeBookId,quote:undefined,rawQuote:undefined,text:flattenComposition(c)};
 const error=validateComposition(next);if(error)throw Error(error);
 if(same(n.composition,next.composition)&&same(n.sources,next.sources)&&n.text===next.text&&same(n.questionIds,next.questionIds))return n;
 return {...next,modifiedAt:at,revisions:[...(n.revisions||[]),snapshot(n,at,reason)]};
}
function attachSource(n,source,paragraphId){
 const c=compositionOf(n),sources=clone(legacySources(n));let found=sources.find(s=>sourceIdentity(s)===sourceIdentity(source));
 if(!found){if(sources.length>=1000)throw Error('这条笔记已有 1000 个来源，请新建一条笔记。');found=clone({...source,capturedAt:source.capturedAt||new Date().toISOString()});sources.push(found);}
 let p=c.paragraphs.find(p=>p.id===paragraphId);if(!p){p={id:globalThis.crypto.randomUUID(),text:'',sourceIds:[]};c.paragraphs.push(p);}
 if(!p.sourceIds.includes(found.id))p.sourceIds.push(found.id);
 return {...n,composition:c,sources,text:flattenComposition(c)};
}
function compositionReferences(notes,source){const key=sourceIdentity(source),hits=[];for(const n of notes){if(!n.composition)continue;const ids=new Set((n.sources||[]).filter(s=>sourceIdentity(s)===key).map(s=>s.id));for(const p of n.composition.paragraphs)if(p.sourceIds.some(id=>ids.has(id)))hits.push({noteId:n.id,paragraphId:p.id,text:p.text,title:n.composition.title||n.text.slice(0,32)});}return hits;}
function compositionMarks(notes,bookId,existingHighlights=[],existingNotes=[],existingZotero=[]){
 const seen=new Set();return notes.filter(n=>n.composition).flatMap(n=>(n.sources||[]).filter(s=>{
  if(s.libraryBookId!==bookId||!s.quote||!s.sourceLocation||!n.composition.paragraphs.some(p=>p.sourceIds.includes(s.id)))return false;
  if(s.origin?.kind==='highlight'&&existingHighlights.some(h=>h.id===s.origin.highlightId)||s.origin?.kind==='process'&&existingNotes.some(p=>p.id===s.origin.readingNoteId)||s.origin?.kind==='zotero'&&existingZotero.some(a=>a.key===s.origin.annotationKey&&a.attachmentKey===s.origin.attachmentKey))return false;
  const key=sourceIdentity(s);if(seen.has(key))return false;seen.add(key);return true;
 }).map(s=>({id:'composition:'+n.id+':'+s.id,libraryBookId:bookId,quote:s.quote,rawQuote:s.rawQuote,locator:s.locator,sourceLocation:s.sourceLocation,pdfSegments:s.pdfSegments,rects:s.rects,at:n.at})));
}
module.exports={sourceIdentity,legacySources,compositionOf,sourceNumbers,flattenComposition,validateComposition,snapshot,withComposition,attachSource,compositionReferences,compositionMarks};
