import {type Notebook,type CrossThought,pagesOf,pageView,pageTitle,numberOf,crossNumber,pageForRecord} from './notebook';
export type QuestionChoice={key:string;id:string;title:string;code:string;path:string;kind:'page'|'question'|'cross'|'group';children:QuestionChoice[];anchors?:{id:string;label:string}[]};
export function questionPath(data:Notebook,id:string):string{
 const owner=[...data.notes,...data.cards,...data.crossThoughts].find(item=>item.thoughts?.some(t=>t.id===id));if(owner)id=owner.id;
 const page=pageForRecord(data,id),view=page?pageView(data,page.id):data,note=view.notes.find(n=>n.id===id)||data.notes.find(n=>n.id===id),cross=data.crossThoughts.find(c=>c.id===id);
 if(note){const chain:string[]=[],seen=new Set<string>();let current=note;while(current&&!seen.has(current.id)){seen.add(current.id);chain.unshift(current.title);const parent=view.notes.find(n=>n.id===current.parent)||data.notes.find(n=>n.id===current.parent);if(!parent)break;current=parent;}const code=numberOf(note,view.notes,view.crossThoughts);return `${code?code+' · ':''}${chain.join(' / ')}`;}
 if(cross)return `${crossNumber(cross)} · ${cross.title||cross.text||'交叉思考'}`;
 return data.externalLabels?.[id]||data.cards.find(c=>c.id===id)?.text||'原有联系';
}
export function crossConnections(data:Notebook,cross:CrossThought){return [...new Set(cross.anchorIds)].map(id=>({id,label:questionPath(data,id)}));}
export function questionChoices(data:Notebook):QuestionChoice[]{
 const result:QuestionChoice[]=[],represented=new Set<string>();
 for(const page of pagesOf(data).filter(p=>!p.archivedAt).sort((a,b)=>a.order-b.order)){
  const view=pageView(data,page.id),notes=view.notes.filter(n=>n.kind==='question'),byParent=new Map<string,typeof notes>();for(const n of notes){const key=n.parent||'';byParent.set(key,[...(byParent.get(key)||[]),n]);}
  const build=(id:string,seen=new Set<string>()):QuestionChoice|null=>{const note=notes.find(n=>n.id===id);if(!note||seen.has(id))return null;represented.add(id);const next=new Set([...seen,id]);return {key:page.id+':'+id,id,title:note.title,code:id===page.rootId?'主问题':numberOf(note,notes,view.crossThoughts),path:questionPath(data,id),kind:id===page.rootId?'page':'question',children:(byParent.get(id)||[]).sort((a,b)=>a.order-b.order).flatMap(n=>{const item=build(n.id,next);return item?[item]:[];})};};
  const root=build(page.rootId);if(root){root.title=pageTitle(data,page);result.push(root);}
 }
 const crosses=data.crossThoughts.slice().sort((a,b)=>a.order-b.order).map(c=>{
  const build=(id:string,seen=new Set<string>()):QuestionChoice|null=>{const note=data.notes.find(n=>n.id===id&&n.kind==='question');if(!note||seen.has(id))return null;represented.add(id);return {key:'cross:'+c.id+':'+id,id,title:note.title,code:numberOf(note,data.notes,data.crossThoughts),path:questionPath(data,id),kind:'question',children:data.notes.filter(n=>n.parent===id&&n.kind==='question').sort((a,b)=>a.order-b.order).flatMap(n=>{const child=build(n.id,new Set([...seen,id]));return child?[child]:[];})};};
  return {key:'cross:'+c.id,id:c.id,title:c.title||c.text||'交叉思考',code:crossNumber(c),path:questionPath(data,c.id),kind:'cross' as const,anchors:crossConnections(data,c),children:data.notes.filter(n=>n.parent===c.id&&n.kind==='question').sort((a,b)=>a.order-b.order).flatMap(n=>{const child=build(n.id);return child?[child]:[];})};
 });
 if(crosses.length)result.push({key:'crosses',id:'',title:'交叉思考',code:String(crosses.length),path:'',kind:'group',children:crosses});
 const remaining=data.notes.filter(n=>n.kind==='question'&&!represented.has(n.id));if(remaining.length)result.push({key:'other',id:'',title:'其他问题',code:'',path:'',kind:'group',children:remaining.map(n=>({key:'other:'+n.id,id:n.id,title:n.title,code:numberOf(n,data.notes,data.crossThoughts),path:questionPath(data,n.id),kind:'question',children:[]}))});
 return result;
}
