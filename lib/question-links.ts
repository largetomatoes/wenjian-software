import {type Notebook,type CrossThought,pagesOf,pageView,pageTitle,numberOf,crossNumber,pageForRecord} from './notebook';
export type QuestionAnchor={id:string;label:string;pageId:string;pageTitle:string};
export type QuestionChoice={key:string;id:string;title:string;code:string;path:string;kind:'page'|'question'|'cross'|'group';children:QuestionChoice[];anchors?:QuestionAnchor[]};
export function questionPath(data:Notebook,id:string):string{
 if(data.externalLabels?.[id])return data.externalLabels[id];
 const owner=[...data.notes,...data.cards,...data.crossThoughts].find(item=>item.thoughts?.some(t=>t.id===id));if(owner)id=owner.id;
 if(data.externalLabels?.[id])return data.externalLabels[id];
 const page=data.viewPageId?pagesOf(data).find(p=>p.id===data.viewPageId):pageForRecord(data,id),view=data.viewPageId?data:page?pageView(data,page.id):data;
 const note=view.notes.find(n=>n.id===id)||data.notes.find(n=>n.id===id),cross=view.crossThoughts.find(c=>c.id===id)||data.crossThoughts.find(c=>c.id===id);
 if(note||cross){
  const chain:string[]=[],seen=new Set<string>();let key:string|null|undefined=id;
  while(key&&!seen.has(key)){
   seen.add(key);const n=view.notes.find(n=>n.id===key)||data.notes.find(n=>n.id===key),c=view.crossThoughts.find(c=>c.id===key)||data.crossThoughts.find(c=>c.id===key);if(!n&&!c)break;
   chain.unshift(n?.title||c?.title||c?.text||'交叉思考');key=n?n.parent:c?.placementParentId;
  }
  const code=note?numberOf(note,view.notes,view.crossThoughts):crossNumber(cross!);
  return [code,chain.join(' / ')].filter(Boolean).join(' · ');
 }
 return data.cards.find(c=>c.id===id)?.text||'原有联系';
}
export function crossConnections(data:Notebook,cross:CrossThought):QuestionAnchor[]{
 return [...new Set(cross.anchorIds)].map(id=>{
  const label=questionPath(data,id),owner=[...data.notes,...data.cards,...data.crossThoughts].find(item=>item.thoughts?.some(t=>t.id===id));
  const page=pageForRecord(data,owner?.id||id),title=page&&data.notes.find(n=>n.id===page.rootId)?.title;
  return {id,label,pageId:page?.id||'external',pageTitle:title||label.replace(/^[\d.X]+ · /,'').split(' / ')[0]||'原有联系'};
 });
}
export function questionChoices(data:Notebook):QuestionChoice[]{
 const result:QuestionChoice[]=[],represented=new Set<string>();
 for(const page of pagesOf(data).filter(p=>!p.archivedAt).sort((a,b)=>a.order-b.order)){
  const view=pageView(data,page.id),notes=view.notes.filter(n=>n.kind==='question'),crosses=view.crossThoughts;
  const parentOf=(id:string)=>notes.find(n=>n.id===id)?.parent??crosses.find(c=>c.id===id)?.placementParentId;
  const records=[...notes,...crosses],byParent=new Map<string,typeof records>();
  for(const record of records){const parent=parentOf(record.id);if(parent)byParent.set(parent,[...(byParent.get(parent)||[]),record]);}
  const build=(id:string,seen=new Set<string>()):QuestionChoice|null=>{
   const note=notes.find(n=>n.id===id),cross=crosses.find(c=>c.id===id);if((!note&&!cross)||seen.has(id))return null;
   represented.add(id);const next=new Set([...seen,id]);
   return {key:page.id+':'+id,id,title:note?.title||cross?.title||cross?.text||'交叉思考',code:id===page.rootId?'主问题':note?numberOf(note,notes,crosses):crossNumber(cross!),path:questionPath(view,id),kind:id===page.rootId?'page':cross?'cross':'question',...(cross?{anchors:crossConnections(data,cross)}:{}),children:(byParent.get(id)||[]).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)).flatMap(record=>{const child=build(record.id,next);return child?[child]:[];})};
  };
  const root=build(page.rootId);if(root){root.title=pageTitle(data,page);result.push(root);}
 }
 const remaining=[...data.notes.filter(n=>n.kind==='question'),...data.crossThoughts].filter(n=>!represented.has(n.id));
 if(remaining.length)result.push({key:'other',id:'',title:'其他问题',code:'',path:'',kind:'group',children:remaining.map(n=>{const cross=data.crossThoughts.find(c=>c.id===n.id);return {key:'other:'+n.id,id:n.id,title:n.title||'交叉思考',code:cross?crossNumber(cross):'',path:questionPath(data,n.id),kind:cross?'cross':'question',children:[]};})});
 return result;
}
