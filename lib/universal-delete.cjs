// Privileged, first-party maintenance only. Never exposed to sandbox plugins.
const {pages,placements,removePlacement,migrateOrganization,validateOrganization}=require('./page-organization.cjs');
const {validSettings}=require('./notebook-settings.cjs');
const {removeSource}=require('./reading-paper.cjs');
const {flattenComposition,snapshot}=require('./reading-composition.cjs');
const collections={question:'notes',cross:'crossThoughts',card:'cards',process:'readingNotes',reading:'bookThoughts',highlight:'libraryHighlights',book:'libraryBooks',reply:'thoughtReplies',manuscript:'manuscripts',link:'links',folder:'libraryFolders',archive:'recordArchives'};
const labels={question:'问题与回答',cross:'交叉思考',card:'卡片',process:'过程笔记',reading:'读书笔记',highlight:'高亮',book:'书籍与文献',reply:'思考回复',manuscript:'文稿',link:'关联',folder:'图书文件夹',archive:'归档记录',page:'问题页',thought:'后来想到的',revision:'修订记录',anchorRevision:'关联修改记录',arrangement:'页面整理记录',chapter:'PDF 章节',zotero:'Zotero 批注',zoteroFolder:'Zotero 分类',ocr:'文字识别缓存',source:'共同笔记来源',block:'成文段落',sentence:'文稿引用',blockSentence:'段落内引用',adoption:'卡片采用记录',tag:'卡片标签',suggestion:'忽略的关联建议',globalTag:'全部卡片的标签'};
const owners=['notes','crossThoughts','cards','readingNotes','bookThoughts'];
const title=r=>r.title||r.name||r.text||r.interpretation||r.quote||r.bookTitle||r.book||r.label||r.type||'记录';
const key=t=>JSON.stringify(Object.fromEntries(Object.entries(t).sort(([a],[b])=>a.localeCompare(b))));
function indexContent(data){
 const result=[],add=(target,name,context='',text='')=>result.push({key:key(target),target,kind:target.kind,label:labels[target.kind],title:String(name).slice(0,200),context:String(context).slice(0,250),text:String(text).slice(0,500)});
 for(const [kind,col]of Object.entries(collections))for(const r of data[col]||[])add({kind,id:r.id},title(r),r.book||r.bookTitle||r.origin||'',r.body||r.interpretation||r.text||r.quote||'');
 for(const p of pages(data))add({kind:'page',id:p.id},title(data.notes.find(n=>n.id===p.rootId)||{}),p.kind==='collection'?'汇总问题页':'问题页');
 for(const col of [...owners,'manuscripts'])for(const r of data[col]||[]){
  for(const t of r.thoughts||[])add({kind:'thought',id:t.id},t.text,title(r),t.text);
  for(const [kind,field]of [['revision','revisions'],['anchorRevision','anchorRevisions'],['source','sources'],['block','blocks'],['sentence','links'],['adoption','adoptions']])for(const [i,v]of (r[field]||[]).entries())add({kind,id:String(i),ownerId:r.id,collection:col},title(v),title(r),v.body||v.text||v.quote||v.reason||'');
  for(const tag of r.tags||[])add({kind:'tag',id:tag,ownerId:r.id,collection:col},tag,title(r));
  if(col==='manuscripts')for(const block of r.blocks||[])for(const l of block.links||[])add({kind:'blockSentence',id:l.id,ownerId:r.id,blockId:block.id},l.quote||'句子关联',title(r));
 }
 for(const p of pages(data))for(const [i,v]of (p.arrangements||[]).entries())add({kind:'arrangement',id:String(i),ownerId:p.id},v.label||'页面整理',title(data.notes.find(n=>n.id===p.rootId)||{}));
 for(const b of data.libraryBooks||[]){
  for(const c of b.pdfChapters||[])add({kind:'chapter',id:c.id,ownerId:b.id},c.title,title(b));
  for(const a of b.zotero?.annotations||[])add({kind:'zotero',id:a.attachmentKey+':'+a.key,ownerId:b.id},a.text||a.comment||'批注',title(b),a.comment||'');
 }
 for(const c of data.zoteroCollections||[])add({kind:'zoteroFolder',id:c.key,ownerId:c.serverId},c.name);
 for(const [i,c]of (data.ocrCache||[]).entries())add({kind:'ocr',id:String(i)},'第 '+c.page+' 页',title(data.libraryBooks.find(b=>b.id===c.libraryBookId)||{}));
 for(const v of data.dismissedSuggestions||[])add({kind:'suggestion',id:v},v);
 for(const tag of new Set((data.cards||[]).flatMap(c=>c.tags||[])))add({kind:'globalTag',id:tag},tag,'所有卡片中的同名标签');
 // Catalogue metadata belongs to this view only; it is never written into notes.
 const pageRows=pages(data),pageNames=new Map(pageRows.map(p=>[p.id,title(data.notes.find(n=>n.id===p.rootId)||{})])),pageOwners=new Map(),records=new Map(),thoughtOwners=new Map(),books=new Map((data.libraryBooks||[]).map(b=>[b.id,b]));
 for(const p of pageRows)for(const row of placements(data,p))pageOwners.set(row.recordId,[...(pageOwners.get(row.recordId)||[]),p.id]);
 for(const [kind,col]of Object.entries(collections))for(const r of data[col]||[]){records.set(r.id,{kind,col,r});for(const t of r.thoughts||[])thoughtOwners.set(t.id,r.id);}
 const archiveIds=new Set((data.recordArchives||[]).filter(a=>a.archived&&!a.purgedAt).map(a=>a.recordId)),historyKinds=new Set(['revision','anchorRevision','arrangement','archive']),organizationKinds=new Set(['folder','zoteroFolder','tag','globalTag','link','suggestion']);
 const location=(bId,bTitle,chapter='')=>{const b=books.get(bId);return {id:bId||'detached:'+String(bTitle||'未填写书名'),title:b?.display?.title||b?.title||bTitle||'未填写书名',chapter:chapter||'',mode:b?.zotero?'zotero':'reading'};};
 for(const e of result){
  const t=e.target,ownerId=t.ownerId||thoughtOwners.get(t.id)||(t.kind==='reply'?records.get(t.id)?.r.thoughtId:null);let record=records.get(ownerId)||records.get(t.id);const ownRecord=record?.r;if(record?.kind==='reply')record=records.get(thoughtOwners.get(record.r.thoughtId))||record;const r=record?.r;
  let pageIds=[...(pageOwners.get(r?.id)||[])],locations=[],cardId=record?.kind==='card'?r.id:undefined,manuscriptId=record?.kind==='manuscript'?r.id:undefined;
  if(t.kind==='page'||t.kind==='arrangement')pageIds=[t.kind==='page'?t.id:t.ownerId];
  for(const q of r?.questionIds||[])pageIds.push(...(pageOwners.get(q)||[]));
  if(record?.kind==='reply'){const owner=records.get(thoughtOwners.get(r.thoughtId));if(owner){pageIds.push(...(pageOwners.get(owner.r.id)||[]));if(owner.kind==='card')cardId=owner.r.id;}}
  if(record?.kind==='book')locations=[location(r.id,r.title,t.kind==='chapter'?(r.pdfChapters||[]).find(c=>c.id===t.id)?.title:'')];
  else if(r?.libraryBookId||r?.book||r?.bookTitle)locations=[location(r.libraryBookId,r.book||r.bookTitle,r.chapter)];
  if(r?.sources?.length)locations=r.sources.map(s=>location(s.libraryBookId,s.bookTitle,s.chapter));
  if(t.kind==='zotero'||t.kind==='chapter')locations=[location(t.ownerId,books.get(t.ownerId)?.title,t.kind==='chapter'?(books.get(t.ownerId)?.pdfChapters||[]).find(c=>c.id===t.id)?.title:'')];
  if(t.kind==='ocr'){const c=data.ocrCache[Number(t.id)];locations=[location(c.libraryBookId)];}
  if(t.kind==='link')for(const id of [r.from,r.to]){pageIds.push(...(pageOwners.get(thoughtOwners.get(id)||id)||[]));const related=records.get(thoughtOwners.get(id)||id);if(related?.kind==='card')cardId=related.r.id;}
  if(t.kind==='archive'){const archived=records.get(r.recordId);pageIds.push(...(pageOwners.get(r.recordId)||[]));if(archived?.kind==='card')cardId=archived.r.id;if(archived?.r.libraryBookId)locations=[location(archived.r.libraryBookId,archived.r.book||archived.r.bookTitle,archived.r.chapter)];}
  const areas=[];if(pageIds.length||t.kind==='page')areas.push('questions');if(locations.length)areas.push('books');if(cardId)areas.push('cards');if(manuscriptId)areas.push('manuscripts');if(organizationKinds.has(t.kind))areas.push('organization');if(historyKinds.has(t.kind)||archiveIds.has(t.id))areas.push('history');
  Object.assign(e,{areas:areas.length?areas:['organization'],pageIds:[...new Set(pageIds)],pageNames:[...new Set(pageIds)].map(id=>pageNames.get(id)||id),bookLocations:locations,cardId,cardKind:cardId?(records.get(cardId)?.r.kind||'idea'):undefined,tags:r?.tags||[],manuscriptId,archived:r?.archived===true||archiveIds.has(t.id)||archiveIds.has(r?.id)||(pageIds.length>0&&pageIds.every(id=>pageRows.find(p=>p.id===id)?.archivedAt)),at:({revision:r?.revisions?.[Number(t.id)]?.at,anchorRevision:r?.anchorRevisions?.[Number(t.id)]?.at,arrangement:pageRows.find(p=>p.id===t.ownerId)?.arrangements?.[Number(t.id)]?.at}[t.kind])||ownRecord?.at||r?.at||r?.addedAt||r?.updatedAt||''});
 }
 for(const e of result)if(e.archived&&!e.areas.includes('history'))e.areas.push('history');
 // Removing a placement changes this view only. Deleting its original is separate.
 for(const p of pageRows)for(const row of placements(data,p))if(row.recordId!==p.rootId){const r=records.get(row.recordId)?.r;if(r)result.push({key:key({kind:'placement',id:row.recordId,ownerId:p.id}),target:{kind:'placement',id:row.recordId,ownerId:p.id},kind:'placement',label:'本页位置',title:title(r),context:pageNames.get(p.id),text:'仅移出本页，原记录及其他页面保留',areas:['questions'],pageIds:[p.id],pageNames:[pageNames.get(p.id)],bookLocations:[],tags:[],archived:!!p.archivedAt,at:row.adoptedAt||r.at||''});}
 return result;
}
function deleteContent(input,target,{at=new Date().toISOString(),id=()=>globalThis.crypto.randomUUID()}={}){
 const entry=indexContent(input).find(v=>key(v.target)===key(target));if(!entry)throw Error('内容已变化，请刷新后重新选择。');
 if(target.kind==='archive'){
  const a=input.recordArchives.find(a=>a.id===target.id);
  if(a.archived&&!a.purgedAt){const original={kind:a.kind,id:a.recordId,...(a.bookId?{ownerId:a.bookId}:{})};if(indexContent(input).some(e=>key(e.target)===key(original))){const result=deleteContent(input,original,{at,id});return {...result,messages:['删除这条归档内容及其归档标记，不会将它重新显示。',...result.messages]};}}
 }
 let data=structuredClone(migrateOrganization(input));const removed=new Set(),messages=[],remove=(col,ids)=>{for(const r of data[col]||[])if(ids.has(r.id)){removed.add(r.id);for(const t of r.thoughts||[])removed.add(t.id);}data[col]=(data[col]||[]).filter(r=>!ids.has(r.id));};
 if(target.kind==='placement'){
  data=removePlacement(data,target.ownerId,target.id,at);messages.push('仅移出当前问题页及本页的下级位置。原记录和其他问题页均保留，不删除原内容。');
 }else if(target.kind==='page'||target.kind==='question'||target.kind==='cross'){
  const page=target.kind==='page'?pages(data).find(p=>p.id===target.id):null,root=page?.rootId||target.id,ids=new Set([root]);
  const deletedPages=new Set(pages(data).filter(p=>p.rootId===root).map(p=>p.id));
  for(let changed=true;changed;){changed=false;for(const n of data.notes)if(ids.has(n.parent)&&!ids.has(n.id)){ids.add(n.id);changed=true;}for(const c of data.crossThoughts)if(deletedPages.has(c.pageId)&&!ids.has(c.id)){ids.add(c.id);changed=true;}}
  remove('notes',ids);remove('crossThoughts',ids);
  const beforePages=pages(data);data.questionPages=beforePages.filter(p=>!deletedPages.has(p.id)).map(p=>{
   const original=placements(data,p),byId=new Map(original.map(r=>[r.recordId,r]));
   const rows=original.filter(r=>!removed.has(r.recordId)).map(r=>{let parent=r.parentId;const seen=new Set();while(parent&&removed.has(parent)&&!seen.has(parent)){seen.add(parent);parent=byId.get(parent)?.parentId||p.rootId;}return {...r,parentId:r.recordId===p.rootId?null:parent||p.rootId,...(deletedPages.has(r.sourcePageId)?{sourcePageId:undefined,sourcePlacementId:undefined}:{})};});
   const changed=JSON.stringify(original)!==JSON.stringify(rows);return {...p,members:p.members.filter(v=>!deletedPages.has(v)),placements:rows,...(changed?{arrangements:[...(p.arrangements||[]),{id:id(),at,label:'万用删除：移除已删除内容的位置',before:original,after:rows}]}:{})};
  });
  // A notebook needs one editable canvas, but the deleted original is not reused.
  if(!data.notes.some(n=>!n.parent)){
   const rootId=id(),pageId='page-'+rootId;data.notes.push({id:rootId,kind:'question',parent:null,order:1,title:'新问题页',body:'',origin:'自己的思考',source:'',at,revisions:[],thoughts:[]});data.questionPages.push({id:pageId,rootId,kind:'question',order:1,members:[],placements:[{id:pageId+'@'+rootId,recordId:rootId,parentId:null,order:1}]});messages.push('最后一个问题页删除后，会留下可重新命名的空白问题页；其他资料保留。');
  }
  messages.push('删除选中的原记录及其原始子问题；所有页面的引用位置一起移除。独立笔记保留，并解除已删除的关联。');
  if(removed.has('world'))messages.push('这会更换资料库的默认根问题。较旧的 Windows 和手机版本需要更新后，才能同步此变更。');
 }else if(collections[target.kind]){
  remove(collections[target.kind],new Set([target.id]));
  if(target.kind==='archive')messages.push('只删除这条归档历史标记；此前已经恢复的原内容保留。');
  if(target.kind==='book')messages.push('删除书目、阅读进度、高亮和识别缓存；独立笔记保留来源文字。书籍原文件保留，供恢复使用；不会删除 Zotero 中的原件。');
  if(target.kind==='book'){const book=input.libraryBooks.find(b=>b.id===target.id);if(book.zotero){const ident=k=>'zotero:'+encodeURIComponent(book.zotero.serverId)+':'+encodeURIComponent(k);data.dismissedSuggestions=[...new Set([...data.dismissedSuggestions,ident(book.zotero.itemKey),...(book.zotero.attachmentKey?[ident(book.zotero.attachmentKey)]:[])])];}}
  if(target.kind==='folder'){for(const b of data.libraryBooks)if(b.folderId===target.id)delete b.folderId;messages.push('文件夹中的书籍保留，回到未分类。');}
 }else if(target.kind==='thought'){
  for(const col of owners)for(const r of data[col])r.thoughts=(r.thoughts||[]).filter(t=>t.id!==target.id);removed.add(target.id);
 }else if(['revision','anchorRevision','source','block','sentence','adoption','tag'].includes(target.kind)){
  const r=data[target.collection]?.find(r=>r.id===target.ownerId);if(!r||![...owners,'manuscripts'].includes(target.collection))throw Error('所属记录不可用。');
  const field={revision:'revisions',anchorRevision:'anchorRevisions',source:'sources',block:'blocks',sentence:'links',adoption:'adoptions',tag:'tags'}[target.kind];
  const compositionBefore=r.composition?structuredClone(r):null;const removedSource=target.kind==='source'?r.sources?.[Number(target.id)]:null;
  if(target.kind==='tag')r.tags=r.tags.filter(v=>v!==target.id);else r[field]=r[field].filter((_v,i)=>i!==Number(target.id));
  if(target.kind==='source'&&r.composition&&removedSource){if(r.composition.paper)r.composition=removeSource(r.composition,removedSource.id,compositionBefore.sources);r.composition.paragraphs=r.composition.paragraphs.map(p=>({...p,sourceIds:p.sourceIds.filter(id=>id!==removedSource.id)}));r.text=flattenComposition(r.composition);r.modifiedAt=at;r.revisions=[...(r.revisions||[]),snapshot(compositionBefore,at,'万用删除：解除来源')];}
  if(target.kind==='source'&&!r.composition&&(r.sources||[]).length<2){
   if(r.sources.length===1){const s=r.sources[0];if(s.libraryBookId)r.libraryBookId=s.libraryBookId;if(s.bookTitle)r.bookTitle=s.bookTitle;if(s.sourceLocation)r.sourceLocation=s.sourceLocation;if(s.locator)r.locator=s.locator;if(s.quote)r.quote=s.quote;}
   delete r.sources;messages.push('来源不足两个，保留为普通笔记。');
  }
 }else if(target.kind==='blockSentence'){const m=data.manuscripts.find(m=>m.id===target.ownerId),b=m.blocks.find(b=>b.id===target.blockId);b.links=b.links.filter(l=>l.id!==target.id);}
 else if(target.kind==='arrangement')data.questionPages=data.questionPages.map(p=>p.id===target.ownerId?{...p,arrangements:(p.arrangements||[]).filter((_r,i)=>i!==Number(target.id))}:p);
 else if(target.kind==='chapter'){const b=data.libraryBooks.find(b=>b.id===target.ownerId);b.pdfChapters=b.pdfChapters.filter(c=>c.id!==target.id);}
 else if(target.kind==='zotero'){
  const b=data.libraryBooks.find(b=>b.id===target.ownerId);b.zotero.annotations=b.zotero.annotations.filter(a=>a.attachmentKey+':'+a.key!==target.id);b.hiddenZoteroAnnotations=[...new Set([...(b.hiddenZoteroAnnotations||[]),target.id])];messages.push('仅删除问间中的这条批注并隐藏后续导入，不改动 Zotero 原件。');
 }else if(target.kind==='zoteroFolder'){
  const deleted=new Set([target.id]);for(let change=true;change;){change=false;for(const c of data.zoteroCollections)if(c.serverId===target.ownerId&&deleted.has(c.parentKey)&&!deleted.has(c.key)){deleted.add(c.key);change=true;}}
  data.zoteroCollections=data.zoteroCollections.filter(c=>c.serverId!==target.ownerId||!deleted.has(c.key));for(const b of data.libraryBooks)if(b.zotero?.serverId===target.ownerId)b.zotero.collections=b.zotero.collections.filter(k=>!deleted.has(k));data.dismissedSuggestions=[...new Set([...data.dismissedSuggestions,...[...deleted].map(k=>'zotero-collection:'+encodeURIComponent(target.ownerId)+':'+encodeURIComponent(k))])];messages.push('仅删除问间中的分类，文献保留；之后的 Zotero 联动不再自动导入这些分类，恢复本次删除即可重新接收。');
 }else if(target.kind==='ocr')data.ocrCache=data.ocrCache.filter((_r,i)=>i!==Number(target.id));
 else if(target.kind==='globalTag'){for(const c of data.cards)if(c.tags)c.tags=c.tags.filter(t=>t!==target.id);messages.push('移除全部卡片上的同名标签，卡片正文与其他标签保留。');}
 else if(target.kind==='suggestion')data.dismissedSuggestions=data.dismissedSuggestions.filter(v=>v!==target.id);
 else throw Error('未知内容类型。');
 // Keep standalone quotations and writing intact; remove dangling live relations.
 data.links=data.links.filter(l=>!removed.has(l.from)&&!removed.has(l.to));
 data.thoughtReplies=data.thoughtReplies.filter(r=>!removed.has(r.thoughtId));
 for(const c of data.crossThoughts){const anchors=c.anchorIds.filter(v=>!removed.has(v));if(anchors.length!==c.anchorIds.length){c.anchorRevisions=[...(c.anchorRevisions||[]),{from:c.anchorIds,to:anchors,at,reason:'万用删除：解除已删除内容的关联'}];c.anchorIds=anchors;}}
 for(const c of data.cards){if(removed.has(c.questionId))delete c.questionId;if(c.adoptions)c.adoptions=c.adoptions.filter(a=>!removed.has(a.questionId));}
 for(const n of data.notes)if(removed.has(n.sourceCardId))delete n.sourceCardId;
 for(const col of ['readingNotes','bookThoughts'])for(const r of data[col]){r.questionIds=r.questionIds.filter(v=>!removed.has(v));if(!r.composition){if(removed.has(r.libraryBookId))delete r.libraryBookId;for(const s of r.sources||[])if(removed.has(s.libraryBookId))delete s.libraryBookId;}}
 const removedHighlights=new Set(data.libraryHighlights.filter(r=>removed.has(r.libraryBookId)).map(r=>r.id));remove('libraryHighlights',removedHighlights);data.ocrCache=data.ocrCache.filter(r=>!removed.has(r.libraryBookId));
 data.links=data.links.filter(l=>!removed.has(l.from)&&!removed.has(l.to));
 for(const m of data.manuscripts){m.links=(m.links||[]).map(l=>removed.has(l.questionId)?{...l,unresolved:true}:l);if(m.blocks)m.blocks=m.blocks.map(b=>removed.has(b.questionId)?{...b,unresolved:true}:b);}
 if(data.recordArchives)data.recordArchives=data.recordArchives.filter(a=>!removed.has(a.recordId)&&!removed.has(a.bookId));
 if(!validSettings(data)||validateOrganization(data))throw Error('删除后的结构无法验证，未保存。');
 const locations=entry.pageIds.map(id=>{const p=pages(input).find(p=>p.id===id);return {id,title:input.notes.find(n=>n.id===p?.rootId)?.title||'问题页',canRemove:['question','cross'].includes(target.kind)&&p?.rootId!==target.id};});
 return {data,title:entry.title,messages,removed:[...removed],target,locations};
}
module.exports={indexContent,deleteContent,labels};
