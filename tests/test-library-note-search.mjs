import assert from 'node:assert/strict';import {load,plain} from './load-ts.cjs';
const {libraryNoteIndex,searchLibraryNotes,matchesNoteText,zoteroAnnotationChapter}=load('lib/library-note-search.ts');
const {initialNotebook}=load('lib/notebook.ts');
const book=(id,title)=>({id,title,author:'作者',display:{title:'显示'+title},format:'pdf',storedFile:id+'.pdf',originalName:id+'.pdf',addedAt:'2026-01-01',progress:{},pdfChapters:[{id:'c1',title:'第一章',startPage:1},{id:'c2',title:'第二章',startPage:10}]});
const process={id:'r1',libraryBookId:'a',book:'旧书名',author:'',chapter:'第一章',locator:'第 2 页',quote:'保留引用的原话',interpretation:'共同线索',questionIds:[],at:'2026-01-01',thoughts:[{id:'t1',text:'后来补充细节',reason:'重新读过之后',origin:'自己的思考',at:'2026-01-02'}]};
const shared={id:'s1',libraryBookId:'a',bookTitle:'旧书名',scope:'location',text:'共同线索',locator:'',at:'2026-01-01',questionIds:[],thoughts:[],sources:[{id:'x1',libraryBookId:'a',bookTitle:'书甲',chapter:'第一章',locator:'第 3 页',quote:'来源甲'}, {id:'x2',libraryBookId:'a',bookTitle:'书甲',chapter:'第二章',locator:'第 11 页',quote:'来源甲二'}, {id:'x3',libraryBookId:'b',bookTitle:'书乙',chapter:'第二章',locator:'第 12 页',quote:'来源乙'}]};
const a=book('a','书甲'),b=book('b','书乙');b.zotero={attachmentKey:'att',annotations:[{key:'z1',attachmentKey:'att',text:'外部摘录',comment:'共同线索',page:12,pageLabel:'12',position:'{}',at:'2026-01-01'},{key:'hidden',attachmentKey:'att',text:'不应出现',comment:'共同线索',at:'2026-01-01'}]};b.hiddenZoteroAnnotations=['att:hidden'];
const data={...plain(initialNotebook),libraryBooks:[a,b],readingNotes:[process],bookThoughts:[shared,{...shared,id:'whole',scope:'book',sources:undefined,chapter:'',text:'全书判断'}],thoughtReplies:[{id:'reply',thoughtId:'t1',text:'对话里才出现的词语',at:'2026-01-03'}]};
const original=JSON.stringify(data),index=libraryNoteIndex(data),all=new Set(['a','b']);
assert.equal(searchLibraryNotes(index,'共同线索',all).length,5,'process + three shared locations + visible Zotero');
assert.equal(searchLibraryNotes(index,'对话里才出现',all)[0].id,'r1');assert.equal(searchLibraryNotes(index,'后来补充',all)[0].id,'r1');assert.equal(searchLibraryNotes(index,'重新读过',all)[0].id,'r1');
assert.equal(searchLibraryNotes(index,'共同线索',new Set(['b'])).length,2,'only current shelf scope');assert.equal(searchLibraryNotes(index,'共同线索',all,'chapter:第二章').length,3);
assert.equal(searchLibraryNotes(index,'全书判断',all)[0].chapter,'全书思考');assert.equal(searchLibraryNotes(index,'',all).length,0);
assert(index.every(hit=>hit.bookTitle.startsWith('显示')));assert(!index.some(hit=>hit.id==='hidden'));assert.equal(zoteroAnnotationChapter(b,{position:'{"pageIndex":11}'}),'第二章');
assert(matchesNoteText('English Words 诚实','english 诚实'));assert(!matchesNoteText('English','english 缺失'));
assert.equal(JSON.stringify(data),original,'search never mutates notes or source metadata');
console.log('PASS: source IDs, display names, process notes, later thoughts/replies, shared multi-book chapters, scope filtering, Zotero exclusions, full-book/unknown chapters and immutable originals');

const {projectPaper,insertCitation,setRelation}=load('lib/reading-paper.cjs');
const {flattenComposition}=load('lib/reading-composition.cjs');
let composition=projectPaper({schema:1,homeBookId:'a',title:'纸上独特标题',paragraphs:[{id:'p',text:'',sourceIds:[]}]},{version:1,markerFormat:'square',body:'两本书之间的共同判断。',citations:[],relations:[]},shared.sources);
for(const source of shared.sources)composition=insertCitation(composition,source.id,composition.paper.body.length,shared.sources).composition;
composition=setRelation(composition,composition.paper.citations.slice(0,2).map(c=>c.id),'关系命名词','关系说明检验词',shared.sources);
const paper={...shared,id:'paper',tags:['独特主题词'],thoughts:[{id:'paper-thought',text:'后来想到检验词',reason:'原因检验词',at:'2026-01-02'}],composition,text:flattenComposition(composition)};
const paperData={...data,bookThoughts:[paper],readingNotes:[],thoughtReplies:[{id:'p-reply',thoughtId:'paper-thought',text:'回答检验词',at:'2026-01-03'}]},savedPaper=JSON.stringify(paperData),paperIndex=libraryNoteIndex(paperData);
for(const query of ['共同判断','独特标题','独特主题词','关系说明检验词','后来想到检验词','原因检验词','回答检验词']){
 assert.equal(searchLibraryNotes(paperIndex,query,new Set(['a'])).length,2,query+' in both chapters of home book');
 assert.equal(searchLibraryNotes(paperIndex,query,new Set(['b'])).length,1,query+' in second source book');
 assert.equal(searchLibraryNotes(paperIndex,query,all,'chapter:第二章').length,2,query+' in matching chapter of both books');
}
assert.equal(searchLibraryNotes(paperIndex,'来源乙',new Set(['b']))[0].sourceLocation,shared.sources[2].sourceLocation);
assert.equal(searchLibraryNotes(paperIndex,'来源甲二',new Set(['a']),'chapter:第二章').length,1);
assert(paperIndex.every(hit=>hit.bookTitle.startsWith('显示')));
assert.equal(JSON.stringify(paperData),savedPaper,'index and query leave the single shared original untouched');

const duplicate={...paper,sources:[...paper.sources,{...paper.sources[0],id:'duplicate'}],composition:{...paper.composition,paragraphs:[...paper.composition.paragraphs,{id:'p2',text:'独立段落的检验词',sourceIds:['x1','duplicate']}]}};
const duplicateIndex=libraryNoteIndex({...paperData,bookThoughts:[duplicate]});
assert.equal(searchLibraryNotes(duplicateIndex,'共同判断',new Set(['a']),'chapter:第一章').length,1,'same note/book/chapter deduplicated across paragraphs and repeated sources');
assert.equal(searchLibraryNotes(duplicateIndex,'独立段落的检验词',new Set(['a'])).length,0,'paper text is the searchable authoritative body');
const legacy={...duplicate,composition:{...duplicate.composition,paper:undefined}};
assert.equal(searchLibraryNotes(libraryNoteIndex({...paperData,bookThoughts:[legacy]}),'独立段落的检验词',new Set(['a']))[0].paragraphId,'p2','legacy query retains the matching paragraph target');

const detachedRefs={...paper,composition:{...paper.composition,paragraphs:[{id:'no-refs',text:'没有来源的正文',sourceIds:[]}],paper:undefined}};
const detachedIndex=libraryNoteIndex({...paperData,bookThoughts:[detachedRefs]});
assert.equal(searchLibraryNotes(detachedIndex,'没有来源',new Set(['b'])).length,0,'unlinked retained source pool does not keep a false cross-book membership in the search');
assert.equal(searchLibraryNotes(detachedIndex,'没有来源',new Set(['a'])).length,1,'home book is always findable');
const onlyOther={...paper,scope:'book',composition:{...paper.composition,paragraphs:[{id:'other',text:'只引用另一本书',sourceIds:['x3']}],paper:undefined}};
assert.equal(searchLibraryNotes(libraryNoteIndex({...paperData,bookThoughts:[onlyOther]}),'只引用另一本书',new Set(['a']))[0].chapter,'全书思考','home scope does not borrow the other book chapter');
assert.equal(searchLibraryNotes(libraryNoteIndex({...paperData,bookThoughts:[{...shared,tags:['旧笔记的主题']}]}),'旧笔记的主题',all).length,3);
console.log('PASS: composed notes, source chapters/books, display titles, themes, relations, thoughts/replies, legacy paragraphs, duplicate sources and home fallback.');
