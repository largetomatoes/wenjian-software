// Plain-text editing with explicit, stable inline footnote anchors.
'use strict';
const {keywordCandidates}=require('./reading-keywords.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function numbers(paper){return new Map([...new Set(paper.citations.map(c=>c.sourceId))].map((id,i)=>[id,i+1]));}
function paperOf(c,sources){
 if(c.paper)return clone(c.paper);
 let body='',citations=[];const known=new Set(sources.map(s=>s.id)),order=new Map();
 for(const p of c.paragraphs){if(body)body+='\n\n';body+=p.text;for(const id of p.sourceIds){if(!known.has(id))continue;if(!order.has(id))order.set(id,order.size+1);const text='〔'+order.get(id)+'〕';citations.push({id:'paper:'+p.id+':'+id,sourceId:id,start:body.length,end:body.length+text.length,kind:'marker'});body+=text;}}
 return {version:1,body,citations,relations:[]};
}
function projectPaper(c,paper,sources){
 const byId=new Map(sources.map(s=>[s.id,s])),order=numbers(paper),sorted=[...paper.citations].sort((a,b)=>a.start-b.start);let body='',cursor=0;const citations=[];
 for(const item of sorted){if(!byId.has(item.sourceId)||item.start<cursor||item.start<0||item.end>paper.body.length)continue;body+=paper.body.slice(cursor,item.start);const marker=citationMarker(item,paper,order),text=item.kind==='quote'?(byId.get(item.sourceId).quote||'')+' '+marker:marker,start=body.length;body+=text;citations.push({...item,start,end:body.length});cursor=item.end;}
 body+=paper.body.slice(cursor);const ids=new Set(citations.map(c=>c.id));const relations=paper.relations.map(r=>({...r,unresolved:r.citationIds.some(id=>!ids.has(id))}));
 const nextPaper={...paper,version:1,body,citations,relations};return {...c,paper:nextPaper,paragraphs:[{id:c.paragraphs[0]?.id||'paper-document',text:body,sourceIds:[...new Set(citations.map(c=>c.sourceId))]}]};
}
function replaceBody(c,body,sources){const paper=paperOf(c,sources),before=paper.body;let start=0;while(start<before.length&&start<body.length&&before[start]===body[start])start++;let oldEnd=before.length,newEnd=body.length;while(oldEnd>start&&newEnd>start&&before[oldEnd-1]===body[newEnd-1]){oldEnd--;newEnd--;}const delta=newEnd-oldEnd;
 const citations=paper.citations.flatMap(q=>{if(q.end<=start)return [q];if(q.start>=oldEnd)return [{...q,start:q.start+delta,end:q.end+delta}];return [];});
 return projectPaper(c,{...paper,body,citations},sources);
}
function insertCitation(c,sourceId,offset,sources,kind='marker',id=globalThis.crypto.randomUUID()){
 const paper=paperOf(c,sources),at=Math.max(0,Math.min(paper.body.length,offset));if(paper.citations.some(q=>at>q.start&&at<q.end))throw Error('请把光标放到引用标记之外。');
 const token='〔?〕',citations=paper.citations.map(q=>q.start>=at?{...q,start:q.start+token.length,end:q.end+token.length}:q);const display=keywordCandidates(sources.find(s=>s.id===sourceId)?.quote||'');citations.push({id,sourceId,start:at,end:at+token.length,kind,displayText:display.label,displayParts:display.parts,displayMode:'auto'});const result=projectPaper(c,{...paper,body:paper.body.slice(0,at)+token+paper.body.slice(at),citations:citations.sort((a,b)=>a.start-b.start)},sources);return {composition:result,citationId:id,caret:result.paper.citations.find(q=>q.id===id)?.end??at};
}
function removeCitation(c,id,sources){const paper=paperOf(c,sources),q=paper.citations.find(q=>q.id===id);if(!q)return c;const quote=q.kind==='quote'?sources.find(s=>s.id===q.sourceId)?.quote||'':'';const delta=quote.length-(q.end-q.start);return projectPaper(c,{...paper,body:paper.body.slice(0,q.start)+quote+paper.body.slice(q.end),citations:paper.citations.filter(x=>x.id!==id).map(x=>x.start>=q.end?{...x,start:x.start+delta,end:x.end+delta}:x)},sources);}
function citationKind(c,id,kind,sources){const paper=paperOf(c,sources);return projectPaper(c,{...paper,citations:paper.citations.map(q=>q.id===id?{...q,kind}:q)},sources);}
function removeSource(c,id,sources){let result=c;for(const q of paperOf(c,sources).citations.filter(q=>q.sourceId===id))result=removeCitation(result,q.id,sources);return result;}
function setRelation(c,ids,label,text,sources,previousId,at=new Date().toISOString()){
 const paper=paperOf(c,sources),selected=[...new Set(ids)];if(selected.length<2||selected.some(id=>!paper.citations.some(q=>q.id===id)))throw Error('请在正文中选择至少两处引用。');if(!label.trim()&&!text.trim())throw Error('请写下关系名称或自己的解释。');
 const previous=paper.relations.find(r=>r.id===previousId),relation={id:previous?.id||globalThis.crypto.randomUUID(),citationIds:selected,label:label.trim(),text:text.trim(),at:previous?.at||at,...(previous?{modifiedAt:at}:{}),references:selected.map(id=>{const q=paper.citations.find(q=>q.id===id),s=sources.find(s=>s.id===q.sourceId);return {citationId:id,sourceId:s.id,quote:s.quote||'',locator:s.locator,bookTitle:s.bookTitle};})};let next=projectPaper(c,{...paper,relations:previous?paper.relations.map(r=>r.id===previous.id?relation:r):[...paper.relations,relation]},sources);
 const rows=next.paper.citations.filter(q=>selected.includes(q.id));
 if(rows.every((q,i)=>!i||/^[ \t—–-]*$/.test(next.paper.body.slice(rows[i-1].end,q.start)))){
  let p=next.paper;for(let i=rows.length-1;i>0;i--){const start=rows[i-1].end,end=rows[i].start,delta=1-(end-start);p={...p,body:p.body.slice(0,start)+'—'+p.body.slice(end),citations:p.citations.map(q=>q.start>=end?{...q,start:q.start+delta,end:q.end+delta}:q)};}next=projectPaper(next,p,sources);
 }
 return next;
}
function flattenPaper(c){const p=c.paper,order=numbers(p);return [c.title?.trim(),p.body,...p.relations.map(r=>{const refs=r.citationIds.map(id=>{const q=p.citations.find(q=>q.id===id);return q?citationMarker(q,p,order):'〔已移除引用〕';}).join(' ↔ ');return refs+' · '+(r.label||'我的联系')+(r.text?'\n'+r.text:'');})].filter(Boolean).join('\n\n');}
function validatePaper(c,sources){const p=c.paper;if(!p)return '';if(p.version!==1||p.markerFormat!==undefined&&p.markerFormat!=='square'||typeof p.body!=='string'||p.body.length>2000000||!Array.isArray(p.citations)||p.citations.length>2000||!Array.isArray(p.relations)||p.relations.length>2000)return '笔记板格式不正确。';const ids=new Set(),sourceIds=new Set(sources.map(s=>s.id));let end=0;
 for(const q of p.citations){if(!q||!q.id||ids.has(q.id)||!sourceIds.has(q.sourceId)||!['quote','marker'].includes(q.kind)||!Number.isInteger(q.start)||!Number.isInteger(q.end)||q.start<end||q.end<=q.start||q.end>p.body.length)return '脚注位置或来源不正确。';if(q.displayText!==undefined&&(typeof q.displayText!=='string'||!q.displayText.trim()||q.displayText.length>120)||q.displayParts!==undefined&&(!Array.isArray(q.displayParts)||!q.displayParts.length||q.displayParts.length>20||q.displayParts.some(p=>typeof p!=='string'||!p.trim())||q.displayParts.join('·')!==q.displayText)||q.displayMode!==undefined&&!['auto','custom'].includes(q.displayMode))return '摘录显示词格式不正确。';ids.add(q.id);end=q.end;}
 for(const r of p.relations){if(!r||!r.id||typeof r.label!=='string'||typeof r.text!=='string'||!Array.isArray(r.citationIds)||new Set(r.citationIds).size!==r.citationIds.length||r.citationIds.length<2||r.citationIds.some(id=>!ids.has(id))&&!r.unresolved)return '引用之间的联系需要保留有效记录。';}
 if(new Set(p.relations.map(r=>r.id)).size!==p.relations.length)return '联系编号重复。';const expected=projectPaper(c,p,sources);if(expected.paper.body!==p.body||JSON.stringify(expected.paragraphs)!==JSON.stringify(c.paragraphs))return '笔记板正文与脚注不一致。';return '';}

function citationMarker(q,paper,order=numbers(paper)){return q.displayText?'【'+q.displayText+'】':paper.markerFormat==='square'?'【'+order.get(q.sourceId)+'】':'〔'+order.get(q.sourceId)+'〕';}
function withAutoDisplays(c,sources){const paper=paperOf(c,sources),cache=new Map();let changed=!c.paper;const citations=paper.citations.map(q=>{if(q.displayText)return q;let value=cache.get(q.sourceId);if(!value){value=keywordCandidates(sources.find(s=>s.id===q.sourceId)?.quote||'');cache.set(q.sourceId,value);}changed=true;return {...q,displayText:value.label,displayParts:value.parts,displayMode:'auto'};});return changed?projectPaper(c,{...paper,citations},sources):c;}
function setCitationDisplay(c,id,parts,sources){const paper=paperOf(c,sources),q=paper.citations.find(q=>q.id===id);if(!q)throw Error('这处引用已改变，请重新打开原文。');const next=parts===null?keywordCandidates(sources.find(s=>s.id===q.sourceId)?.quote||'').parts:[...new Set(parts.map(p=>String(p).replace(/\s+/g,' ').trim()).filter(Boolean))];const text=next.join('·');if(!text)throw Error('请至少保留一个显示词，可以先选择其他词。');if(text.length>120||next.length>20)throw Error('显示词过长，请选择较短的几个词。');return projectPaper(c,{...paper,citations:paper.citations.map(v=>v.id===id?{...v,displayText:text,displayParts:next,displayMode:parts===null?'auto':'custom'}:v)},sources);}

module.exports={citationMarker,withAutoDisplays,setCitationDisplay,paperOf,projectPaper,replaceBody,insertCitation,removeCitation,citationKind,removeSource,setRelation,flattenPaper,validatePaper,numbers};
