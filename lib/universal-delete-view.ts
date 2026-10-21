export type DeleteTarget={kind:string;id:string;ownerId?:string;collection?:string;bookId?:string;blockId?:string};
export type DeleteArea='questions'|'books'|'cards'|'manuscripts'|'organization'|'history';
export type DeleteEntry={key:string;target:DeleteTarget;kind:string;label:string;title:string;context:string;text:string;areas:DeleteArea[];pageIds:string[];pageNames:string[];bookLocations:{id:string;title:string;chapter:string;mode:string}[];cardId?:string;cardKind?:string;tags:string[];manuscriptId?:string;archived:boolean;at:string};
export type DeleteFilter={area:DeleteArea;owner:string;chapter:string;mode:string;cardKind:string;tag:string;kind:string;query:string;state:string;from:string;to:string};
export const deleteAreas:{id:DeleteArea;label:string}[]=[{id:'questions',label:'问题页'},{id:'books',label:'书籍与文献'},{id:'cards',label:'卡片集'},{id:'manuscripts',label:'文稿'},{id:'organization',label:'分类与收纳'},{id:'history',label:'历史与归档'}];
export const emptyDeleteFilter=(area:DeleteArea='questions'):DeleteFilter=>({area,owner:'all',chapter:'all',mode:'all',cardKind:'all',tag:'all',kind:'all',query:'',state:'all',from:'',to:''});
export function matchesDeleteEntry(e:DeleteEntry,f:DeleteFilter){
 if(!e.areas.includes(f.area)||f.kind!=='all'&&e.kind!==f.kind||f.kind==='all'&&e.kind==='placement')return false;
 if(f.state==='archived'&&!e.archived||f.state==='current'&&e.archived)return false;
 if(f.area==='questions'&&f.owner!=='all'&&!e.pageIds.includes(f.owner))return false;
 if(f.area==='books'&&!e.bookLocations.some(b=>(f.owner==='all'||b.id===f.owner)&&(f.mode==='all'||b.mode===f.mode)&&(f.chapter==='all'||b.chapter===f.chapter)))return false;
 if(f.area==='cards'&&(f.cardKind!=='all'&&e.cardKind!==f.cardKind||f.tag!=='all'&&!e.tags.includes(f.tag)))return false;
 if(f.area==='manuscripts'&&f.owner!=='all'&&e.manuscriptId!==f.owner)return false;
 if(f.area==='history'&&f.owner!=='all'&&!e.pageIds.some(id=>'page:'+id===f.owner)&&!e.bookLocations.some(b=>'book:'+b.id===f.owner)&&'manuscript:'+e.manuscriptId!==f.owner)return false;
 if(f.from||f.to){const at=Date.parse(e.at);if(!Number.isFinite(at)||f.from&&at<new Date(f.from+'T00:00:00').getTime()||f.to&&at>new Date(f.to+'T23:59:59.999').getTime())return false;}
 const q=f.query.trim().toLocaleLowerCase();return !q||[e.title,e.context,e.text,...e.pageNames,...e.bookLocations.map(b=>b.title),...e.tags].some(v=>v.toLocaleLowerCase().includes(q));
}
export function deleteOwnerChoices(entries:DeleteEntry[],area:DeleteArea,mode='all'){
 const names=new Map<string,string>(),manuscripts=new Map(entries.filter(e=>e.kind==='manuscript').map(e=>[e.manuscriptId,e.title]));
 for(const e of entries.filter(e=>e.areas.includes(area))){
  if(area==='questions'||area==='history')e.pageIds.forEach((id,i)=>names.set((area==='history'?'page:':'')+id,(area==='history'?'问题页 · ':'')+(e.pageNames[i]||id)));
  if(area==='books'||area==='history')for(const b of e.bookLocations)if(mode==='all'||b.mode===mode)names.set((area==='history'?'book:':'')+b.id,(area==='history'?'书籍 · ':'')+b.title);
  if((area==='manuscripts'||area==='history')&&e.manuscriptId)names.set((area==='history'?'manuscript:':'')+e.manuscriptId,(area==='history'?'文稿 · ':'')+(manuscripts.get(e.manuscriptId)||e.context||e.title));
 }
 return [...names].map(([id,title])=>({id,title})).sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
}
