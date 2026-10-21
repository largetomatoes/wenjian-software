// Shared data-only plugin model. Host permissions and storage stay in platform adapters.
const {pages,placements,placementCodes,registerPageAdditions,movePlacement,includeBranch,migrateOrganization}=require('./page-organization.cjs');
const {archiveRecords,archiveQuestionBranch,visibleNotebook,purgeArchiveBatch}=require('./record-archives.cjs');
const {removeRecords}=require('./maintenance.cjs');
const {validateCoreTransition,validateReadingTransition,validSettings}=require('./notebook-settings.cjs');
const columns={question:'notes',cross:'crossThoughts',card:'cards',process:'readingNotes',reading:'bookThoughts',highlight:'libraryHighlights',book:'libraryBooks',reply:'thoughtReplies',manuscript:'manuscripts'};
const copy=v=>structuredClone(v),uid=()=>globalThis.crypto.randomUUID(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function text(v,max=200000){if(typeof v!=='string'||v.length>max)throw Error('文字格式或长度无效。');return v;}
function boundedIds(v,max=1000){if(!Array.isArray(v)||v.length>max||v.some(x=>typeof x!=='string'||x.length>150)||new Set(v).size!==v.length)throw Error('资料范围无效。');return [...v];}
function normalizeScope(data,value){
 const scope={pageIds:boundedIds(value?.pageIds||[]),bookIds:boundedIds(value?.bookIds||[]),cards:value?.cards===true,includeArchived:value?.includeArchived===true};
 if(scope.pageIds.some(id=>!pages(data).some(p=>p.id===id))||scope.bookIds.some(id=>!data.libraryBooks.some(b=>b.id===id)))throw Error('授权的资料已变化，请重新选择。');return scope;
}
function scopeSets(data,scope,forWrite=false){
 const source=scope.includeArchived||forWrite?data:visibleNotebook(data),pageIds=new Set(scope.pageIds),questionIds=new Set(pages(source).filter(p=>pageIds.has(p.id)).flatMap(p=>placements(source,p).map(r=>r.recordId))),bookIds=new Set(scope.bookIds),ids=new Set(questionIds);
 const includeReading=r=>(r.questionIds||[]).some(id=>questionIds.has(id))||bookIds.has(r.libraryBookId)||(r.sources||[]).some(s=>bookIds.has(s.libraryBookId));
 const selected={notes:source.notes.filter(r=>questionIds.has(r.id)),crossThoughts:source.crossThoughts.filter(r=>questionIds.has(r.id)),cards:scope.cards?source.cards:[],readingNotes:source.readingNotes.filter(includeReading),bookThoughts:source.bookThoughts.filter(includeReading),libraryBooks:source.libraryBooks.filter(r=>bookIds.has(r.id)),libraryHighlights:source.libraryHighlights.filter(r=>bookIds.has(r.libraryBookId)),manuscripts:source.manuscripts.filter(r=>(r.links||[]).some(l=>questionIds.has(l.questionId))||(r.blocks||[]).some(b=>questionIds.has(b.questionId)))};
 for(const rows of Object.values(selected))for(const r of rows){ids.add(r.id);for(const t of r.thoughts||[])ids.add(t.id);}
 selected.thoughtReplies=source.thoughtReplies.filter(r=>ids.has(r.thoughtId));for(const r of selected.thoughtReplies)ids.add(r.id);
 return {source,selected,ids,questionIds,bookIds,pageIds};
}
function sanitize(value){if(Array.isArray(value))return value.map(sanitize);if(!value||typeof value!=='object')return value;const out={};for(const [k,v]of Object.entries(value)){if(['__proto__','constructor','prototype','storedFile','sourceFile','originalName','cloudFile','serverId','storageDirectory','sync','syncRevision','ocrCache'].includes(k))continue;out[k]=sanitize(v);}return out;}
function scopedSnapshot(store,scope){const {selected,ids,pageIds,source}=scopeSets(store.data,scope);const data=sanitize({...selected,questionPages:pages(source).filter(p=>pageIds.has(p.id)).map(p=>({id:p.id,rootId:p.rootId,kind:p.kind,order:p.order,archivedAt:p.archivedAt,placements:placements(source,p).filter(r=>ids.has(r.recordId)).map(r=>({id:r.id,recordId:r.recordId,parentId:r.parentId,order:r.order}))})),links:source.links.filter(l=>ids.has(l.from)&&ids.has(l.to)),recordArchives:(source.recordArchives||[]).filter(r=>ids.has(r.recordId))});return {schema:2,version:store.version,scope:copy(scope),data};}
function scopedGraph(store,scope){
 const {source,questionIds,pageIds}=scopeSets(store.data,scope),nodes=[],edges=[],labels=new Map();
 for(const p of pages(source).filter(p=>pageIds.has(p.id))){const rows=placements(source,p),code=placementCodes(source,p,rows);for(const r of rows){const n=source.notes.find(n=>n.id===r.recordId)||source.crossThoughts.find(n=>n.id===r.recordId);if(!n)continue;const key=p.id+':'+r.recordId;nodes.push({key,id:n.id,pageId:p.id,code:code(n.id),kind:n.anchorIds?'cross':n.kind,title:n.title||n.text||'',parentId:r.parentId,order:r.order});labels.set(n.id,n.title||'');if(r.parentId)edges.push({from:r.parentId,to:r.recordId,fromKey:p.id+':'+r.parentId,toKey:key,kind:'parent',pageId:p.id});}}
 for(const c of source.crossThoughts.filter(c=>questionIds.has(c.id)))for(const target of nodes.filter(n=>n.id===c.id))for(const from of c.anchorIds){const source=nodes.find(n=>n.id===from&&n.pageId===target.pageId)||nodes.find(n=>n.id===from);edges.push({from,to:c.id,fromKey:source?.key,toKey:target.key,pageId:target.pageId,kind:'cross',external:!questionIds.has(from)});}
 for(const l of source.links.filter(l=>questionIds.has(l.from)&&questionIds.has(l.to)))edges.push({...l,fromKey:nodes.find(n=>n.id===l.from)?.key,toKey:nodes.find(n=>n.id===l.to)?.key,kind:'link'});return {schema:2,version:store.version,nodes,edges};
}
function must(set,id){if(typeof id!=='string'||!set.has(id))throw Error('这条记录不在当前授权范围内。');}
function assertPermission(grant,p){if(!grant.permissions.includes(p))throw Error('此插件未获授权：'+p);}
function proposedChanges(store,grant,operations,reason){
 if(!Array.isArray(operations)||!operations.length||operations.length>50)throw Error('每次提交 1 至 50 项修改。');text(reason,500);if(!reason.trim())throw Error('请填写本次修改原因。');
 let data=copy(store.data),summary=[],created=[];const at=new Date().toISOString(),batchId=uid(),label='插件「'+grant.name+'」：'+reason.trim(),scope=grant.scope,initial=scopeSets(data,scope),permitted=new Set(initial.ids);
 function sets(){const s=scopeSets(data,scope);for(const id of created) s.ids.add(id);return s;}
 function target(op){const col=columns[op.kind];if(!col)throw Error('不支持的记录类型。');must(permitted,op.id);const r=data[col].find(r=>r.id===op.id);if(!r)throw Error('记录已经变化。');return [col,r];}
 function questionIds(v){const ids=boundedIds(v,100);for(const id of ids)must(sets().questionIds,id);return ids;}
 function put(col,r){data[col]=data[col].map(n=>n.id===r.id?r:n);}
 for(const op of operations){
  if(!op||typeof op!=='object')throw Error('修改格式无效。');
  if(op.action==='update'){
   assertPermission(grant,'notebook.write');const [col,old]=target(op),patch=op.patch;if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('修改字段无效。');
   const allowed={question:['title','body','origin','source'],cross:['title','text','origin','source'],card:['text','origin','source','kind','tags'],process:['interpretation','questionIds'],reading:['text','questionIds'],manuscript:['title','body']}[op.kind];if(!allowed||Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('此字段需要专用接口，不能覆盖身份、原文或历史。');
   const next={...old};for(const [k,v]of Object.entries(patch)){if(k==='questionIds')next[k]=questionIds(v);else if(k==='tags'){if(!Array.isArray(v)||v.length>100||v.some(t=>typeof t!=='string'||t.length>80))throw Error('标签格式无效。');next[k]=[...new Set(v)];}else next[k]=text(v,['title','kind'].includes(k)?300:200000);}
   if(next.title!==undefined&&!next.title.trim())throw Error('标题不能为空。');if(op.kind==='card'&&!['idea','question'].includes(next.kind||'idea'))throw Error('卡片类型无效。');if(same(old,next))continue;
   if(op.kind==='question')next.revisions=[...old.revisions,{title:old.title,body:old.body,origin:old.origin,source:old.source,reason:label,at}];
   if(op.kind==='cross')next.revisions=[...(old.revisions||[]),{id:uid(),title:old.title,text:old.text,origin:old.origin,source:old.source,reason:label,at}];
   if(op.kind==='card')next.revisions=[...(old.revisions||[]),{id:uid(),text:old.text,origin:old.origin,source:old.source,kind:old.kind||'idea',tags:old.tags||[],at,reason:label}];
   if(op.kind==='process'&&old.interpretation!==next.interpretation)next.revisions=[...(old.revisions||[]),{id:uid(),text:old.interpretation,at,reason:label}];
   if(op.kind==='reading')next.revisions=[...(old.revisions||[]),{id:uid(),text:old.text,sources:old.sources||[],questionIds:old.questionIds,at,reason:label}];
   if(op.kind==='manuscript'){next.revisions=[...(old.revisions||[]),{title:old.title,body:old.body,links:old.links||[],blocks:old.blocks,at}];next.links=(old.links||[]).map(l=>({...l,unresolved:true}));next.updatedAt=at;}
   next.modifiedAt=at;put(col,next);summary.push('修改：'+(old.title||old.bookTitle||old.text||old.quote||'记录').slice(0,90));
  }else if(op.action==='create'){
   assertPermission(grant,'notebook.write');const id=uid();let r,col;
   if(op.kind==='question'){
    must(sets().pageIds,op.pageId);must(sets().questionIds,op.parentId);if(!placements(data,pages(data).find(p=>p.id===op.pageId)).some(r=>r.recordId===op.parentId))throw Error('上级问题不在目标页。');const title=text(op.title,300).trim();if(!title)throw Error('请填写问题标题。');r={id,kind:'question',parent:op.parentId,order:Math.max(0,...data.notes.filter(n=>n.parent===op.parentId).map(n=>n.order))+1,title,body:text(op.body||''),origin:'自己的思考',source:label,at,revisions:[],thoughts:[]};col='notes';const before=data;data={...data,notes:[...data.notes,r]};data=registerPageAdditions(before,data,op.pageId);
   }else if(op.kind==='card'){
    if(!scope.cards)throw Error('未授权卡片集。');r={id,kind:op.cardKind==='question'?'question':'idea',text:text(op.text),origin:'自己的思考',source:label,tags:[],at,thoughts:[]};col='cards';data.cards.push(r);
   }else if(op.kind==='reading'){
    must(sets().bookIds,op.libraryBookId);const book=data.libraryBooks.find(b=>b.id===op.libraryBookId);r={id,libraryBookId:book.id,bookTitle:book.display?.title||book.title,text:text(op.text),scope:'book',locator:'',questionIds:questionIds(op.questionIds||[]),at,thoughts:[]};col='bookThoughts';data[col].push(r);
   }else throw Error('创建类型暂不支持。');created.push(id);permitted.add(id);summary.push('新增：'+(r.title||r.text).slice(0,90));
  }else if(op.action==='cross'){
   assertPermission(grant,'notebook.write');const anchors=questionIds(op.anchorIds);if(anchors.length<2)throw Error('交叉思考至少关联两个问题。');must(sets().pageIds,op.pageId);const title=text(op.title,300).trim();if(!title)throw Error('请填写交叉标题。');const id=uid(),c={id,pageId:op.pageId,title,text:text(op.text||''),order:Math.max(0,...data.crossThoughts.map(c=>c.order))+1,anchorIds:anchors,anchorRevisions:[],origin:'自己的思考',source:label,at,thoughts:[]};const before=data;data={...data,crossThoughts:[...data.crossThoughts,c]};data=registerPageAdditions(before,data,op.pageId);created.push(id);permitted.add(id);summary.push('新增交叉思考：'+title);
  }else if(op.action==='link'){
   assertPermission(grant,'notebook.write');must(permitted,op.from);must(permitted,op.to);if(op.from===op.to)throw Error('请关联不同记录。');if(!data.links.some(l=>l.from===op.from&&l.to===op.to))data.links.push({id:uid(),from:op.from,to:op.to,type:text(op.type||'关联',100)});summary.push('新增两条记录间的关联');
  }else if(op.action==='move'||op.action==='include'){
   assertPermission(grant,'notebook.write');must(sets().pageIds,op.pageId);must(sets().questionIds,op.recordId);must(sets().questionIds,op.parentId);if(op.beforeId)must(sets().questionIds,op.beforeId);
   if(op.action==='include'){must(sets().pageIds,op.sourcePageId);data=includeBranch(data,op.pageId,op.sourcePageId,op.recordId,op.parentId,op.withChildren!==false,at);}else data=movePlacement(data,op.pageId,op.recordId,op.parentId,op.beforeId,at);summary.push('调整问题页位置（保留原始归属和整理记录）');
  }else if(['archive','restore','purge'].includes(op.action)){
   assertPermission(grant,op.action==='purge'?'notebook.delete':'notebook.archive');const [col,r]=target(op);if(op.kind==='manuscript')throw Error('文稿暂不支持此项维护。');
   if(op.action==='archive'){
    if(op.kind==='question'){if(!r.parent)throw Error('核心问题请在主程序归档问题页。');const ids=new Set([r.id]);for(let changed=true;changed;){changed=false;for(const n of data.notes)if(ids.has(n.parent)&&!ids.has(n.id)){must(permitted,n.id);ids.add(n.id);changed=true;}}data=archiveQuestionBranch(data,r.id,{at,batchId});summary.push('归档问题分支，共 '+ids.size+' 条问题');}
    else{data=archiveRecords(data,[{kind:op.kind,id:op.id}],{at,batchId});summary.push('归档：'+(r.title||r.text||r.quote||'记录').slice(0,90));}
   }else if(op.action==='restore'){
    if(!scope.includeArchived)throw Error('恢复需要包含已归档记录的授权。');const entry=(data.recordArchives||[]).find(a=>a.kind===op.kind&&a.recordId===op.id&&a.archived&&!a.purgedAt);if(!entry)throw Error('这条记录不在可恢复归档中。');data.recordArchives=data.recordArchives.map(a=>a===entry?{...a,archived:false,at,events:[...a.events,{action:'restore',at,batchId}]}:a);summary.push('恢复归档：'+entry.label);
   }else{
    if(['question','cross','book'].includes(op.kind))throw Error('问题、交叉思考和书籍请使用归档；保留被引用的原件。');
    const purgeId=uid();data=archiveRecords(data,[{kind:op.kind,id:op.id}],{at,batchId:purgeId});let existing=data.recordArchives.find(a=>a.kind===op.kind&&a.recordId===op.id);if(existing.batchId!==purgeId)data.recordArchives=data.recordArchives.map(a=>a===existing?{...a,batchId:purgeId}:a);
    data=purgeArchiveBatch(data,purgeId,removeRecords,at);permitted.delete(op.id);summary.push('清除：'+(r.title||r.text||r.quote||r.interpretation||'记录').slice(0,90)+'（保留后续思考与恢复副本）');
   }
  }else throw Error('不支持的修改操作。');
 }
 if(!summary.length||same(store.data,data))throw Error('本次没有需要保存的变化。');
 // Native maintenance is the only path allowed to remove or archive records.
 const maintenance=operations.some(op=>['archive','restore','purge'].includes(op.action));
 if(!validSettings(data))throw Error('修改后的问题页结构无效，未保存。');
 if(!maintenance){const error=validateCoreTransition(store.data,data)||validateReadingTransition(store.data,data);if(error)throw Error(error);}
 else {const baseline={...store.data,recordArchives:data.recordArchives,notes:store.data.notes.filter(n=>data.notes.some(v=>v.id===n.id)),cards:store.data.cards.filter(n=>data.cards.some(v=>v.id===n.id)),readingNotes:store.data.readingNotes.filter(n=>data.readingNotes.some(v=>v.id===n.id)),bookThoughts:store.data.bookThoughts.filter(n=>data.bookThoughts.some(v=>v.id===n.id))};const error=validateCoreTransition(baseline,data)||validateReadingTransition(baseline,data,true);if(error)throw Error(error);}
 return {data,summary,created,at,batchId,reason:label,version:store.version,destructive:operations.some(op=>op.action==='purge')};
}
function differences(before,after){const out=[];for(const k of new Set([...Object.keys(before),...Object.keys(after)])){const a=before[k],b=after[k];if(same(a,b))continue;if(Array.isArray(a)&&Array.isArray(b)&&[...a,...b].every(r=>r&&typeof r.id==='string')){const aa=new Map(a.map(r=>[r.id,r])),bb=new Map(b.map(r=>[r.id,r]));for(const id of new Set([...aa.keys(),...bb.keys()]))if(!same(aa.get(id),bb.get(id)))out.push({collection:k,id,index:a.findIndex(r=>r.id===id),before:aa.get(id),after:bb.get(id)});}else out.push({collection:k,before:a,after:b});}return out;}
function undoChanges(data,changes){const next=copy(data);for(const c of changes){if(c.id){const rows=next[c.collection],i=rows.findIndex(r=>r.id===c.id),now=i<0?undefined:rows[i];if(same(now,c.before))continue;if(!same(now,c.after))throw Error('相关记录后来又有修改，恢复副本已保留，请手动核对。');if(c.before===undefined){if(i>=0)rows.splice(i,1);}else if(i>=0)rows[i]=copy(c.before);else rows.splice(Math.min(Math.max(0,c.index??rows.length),rows.length),0,copy(c.before));}else{if(same(next[c.collection],c.before))continue;if(!same(next[c.collection],c.after))throw Error('相关结构后来又有修改，不能自动覆盖。');if(c.before===undefined)delete next[c.collection];else next[c.collection]=copy(c.before);}}if(!validSettings(next))throw Error('恢复后的结构与后来内容冲突，未改动资料。');return next;}
module.exports={normalizeScope,scopeSets,scopedSnapshot,scopedGraph,proposedChanges,differences,undoChanges,sanitize,assertPermission};
