import {ROOT} from './notebook';
import {graphOwners,type GraphProjection,type GraphData} from './graph-projection';
export type GraphPosition={x:number;y:number};
export const GRAPH_NODE_WIDTH=260,GRAPH_NODE_HEIGHT=84,GRAPH_COLUMN=354,GRAPH_ROW=200;
export const CROSS_BADGE_WIDTH=198,CROSS_BADGE_HEIGHT=30;
const CROSS_ROW=132;
export type CrossLane={id:string;area:string;x:number;y:number;width:number;height:number;nodes:{id:string;x:number;y:number;parent:string|null}[]};
export type QuestionRowLayout={positions:Record<string,GraphPosition>;mainIds:string[];crossOwners:Record<string,string>;lanes:Record<string,CrossLane>;input?:{data:GraphData;projection:GraphProjection}};

/** A folded crossing occupies only its badge. An opened tree reserves its
 * complete sibling rows inside that gap. Only that gap grows; later rows shift
 * together without changing the spacing of any unrelated branch. */
export function layoutQuestionRows(data:GraphData,projection:GraphProjection,expandedIds:Iterable<string>=[]):QuestionRowLayout{
 const expanded=new Set(expandedIds);
 const positions:Record<string,GraphPosition>={},crossOwners:Record<string,string>={},lanes:Record<string,CrossLane>={},visible=new Set(projection.visibleIds);
 const notes=new Map(data.notes.map(n=>[n.id,n])),crosses=[...data.crossThoughts].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)),crossMap=new Map(crosses.map(c=>[c.id,c]));
 const owners=graphOwners(data),children=new Map<string,string[]>();
 for(const n of data.notes){const seen=new Set<string>();let parent=n.parent;while(parent&&!seen.has(parent)){seen.add(parent);if(crossMap.has(parent)){crossOwners[n.id]=parent;break;}parent=notes.get(parent)?.parent||null;}}
 for(const n of [...data.notes].sort((a,b)=>a.kind===b.kind?a.order-b.order||a.id.localeCompare(b.id):a.kind==='question'?-1:1))if(n.parent)children.set(n.parent,[...(children.get(n.parent)||[]),n.id]);
 const counts=new Map<string,number>();
 const count=(id:string):number=>{if(counts.has(id))return counts.get(id)!;counts.set(id,1);const value=Math.max(1,(children.get(id)||[]).reduce((sum,key)=>sum+count(key),0));counts.set(id,value);return value;};
 const ordinary:Record<string,{x:number;row:number}>={};
 function place(id:string,x:number,row:number,seen=new Set<string>()){
  if(seen.has(id)||ordinary[id]||crossOwners[id]||!visible.has(id))return;
  ordinary[id]={x,row};let next=row;for(const child of children.get(id)||[]){if(crossOwners[child])continue;place(child,x+GRAPH_COLUMN,next,new Set([...seen,id]));next+=count(child);}
 }
 const rootId=data.notes.find(n=>!n.parent&&!crossOwners[n.id])?.id||ROOT,branches=(children.get(rootId)||[]).filter(id=>!crossOwners[id]),band=Math.max(1,...branches.map(count));
 branches.forEach((id,i)=>place(id,GRAPH_COLUMN,i*band));
 if(visible.has(rootId))ordinary[rootId]={x:0,row:branches.length?(branches.length-1)*band/2:0};
 let lastRow=Math.max(0,...Object.values(ordinary).map(p=>p.row));
 for(const n of data.notes)if(!crossOwners[n.id]&&!ordinary[n.id]&&visible.has(n.id)){lastRow++;place(n.id,GRAPH_COLUMN,lastRow);lastRow=Math.max(lastRow,...Object.values(ordinary).map(p=>p.row));}
 for(const card of data.cards)if(visible.has(card.id)&&!ordinary[card.id])ordinary[card.id]={x:GRAPH_COLUMN,row:++lastRow};
 const mainIds=Object.keys(ordinary),rowIds=[...new Set(mainIds.filter(id=>id!==rootId).map(id=>ordinary[id].row))].sort((a,b)=>a-b);if(!rowIds.length)rowIds.push(0);
 // Infer a source's row through its actual parent/cross, including deep sources.
 const rowMemo=new Map<string,number>(),xMemo=new Map<string,number>();
 function sourceRow(key:string,seen=new Set<string>()):number{key=owners.get(key)||key;if(ordinary[key])return ordinary[key].row;if(seen.has(key))return 0;if(rowMemo.has(key))return rowMemo.get(key)!;const next=new Set([...seen,key]),note=notes.get(key),cross=crossMap.get(key);const value=note?.parent?sourceRow(note.parent,next):cross?.anchorIds.length?cross.anchorIds.reduce((sum,id)=>sum+sourceRow(id,next),0)/cross.anchorIds.length:0;rowMemo.set(key,value);return value;}
 function sourceX(key:string,seen=new Set<string>()):number{key=owners.get(key)||key;if(ordinary[key])return ordinary[key].x;if(seen.has(key))return GRAPH_COLUMN;if(xMemo.has(key))return xMemo.get(key)!;const next=new Set([...seen,key]),note=notes.get(key),cross=crossMap.get(key);const value=note?.parent?sourceX(note.parent,next)+GRAPH_COLUMN:cross?.anchorIds.length?GRAPH_COLUMN*Math.max(1,Math.round(cross.anchorIds.reduce((sum,id)=>sum+sourceX(id,next),0)/cross.anchorIds.length/GRAPH_COLUMN)):GRAPH_COLUMN;xMemo.set(key,value);return value;}
 const groups=new Map<number,{id:string;x:number;rows:number;nodes:CrossLane['nodes']}[]>();
 for(const cross of crosses){
  const row=sourceRow(cross.id),slot=rowIds.reduce((best,r)=>Math.abs(r+.5-row)<Math.abs(best+.5-row)?r:best,rowIds[0]);
  const nodes:CrossLane['nodes']=[{id:cross.id,x:0,y:0,parent:null}],seen=new Set([cross.id]);
  const descend=(parent:string,depth:number,start:number)=>{let next=start;for(const child of children.get(parent)||[]){if(seen.has(child)||crossOwners[child]!==cross.id)continue;seen.add(child);nodes.push({id:child,parent,x:depth*GRAPH_COLUMN,y:next*CROSS_ROW});descend(child,depth+1,next);next+=count(child);}};
  descend(cross.id,1,0);const group=groups.get(slot)||[];group.push({id:cross.id,x:sourceX(cross.id),rows:count(cross.id),nodes});groups.set(slot,group);
 }
 const height=(cross:{id:string;rows:number})=>expanded.has(cross.id)?GRAPH_NODE_HEIGHT+(cross.rows-1)*CROSS_ROW:CROSS_BADGE_HEIGHT;
 const visibleHeight=(row:number)=>{const group=groups.get(row)||[],opened=group.filter(c=>expanded.has(c.id)),folded=group.some(c=>!expanded.has(c.id));return opened.reduce((sum,c)=>sum+height(c),0)+(folded?CROSS_BADGE_HEIGHT:0)+Math.max(0,opened.length+(folded?1:0)-1)*24;};
 const step=(row:number)=>Math.max(GRAPH_ROW,GRAPH_NODE_HEIGHT+64+visibleHeight(row));
 // Only the opened gap grows. Subsequent rows shift as one sequence, retaining
 // every other gap; no global maximum is applied to unrelated main branches.
 const actualRows=new Map<number,number>();let y=0;
 for(let row=0;row<=Math.ceil(lastRow)+1;row++){actualRows.set(row,y);y+=step(row);}
 for(const[id,p]of Object.entries(ordinary))positions[id]={x:p.x,y:actualRows.get(p.row)||0};
 if(positions[rootId])positions[rootId].y=branches.length?((actualRows.get(0)||0)+(actualRows.get((branches.length-1)*band)||0))/2:0;
 for(const[slot,group]of groups){let top=(actualRows.get(slot)||0)+GRAPH_NODE_HEIGHT+(step(slot)-GRAPH_NODE_HEIGHT-visibleHeight(slot))/2;
  const folded=group.filter(c=>!expanded.has(c.id)),opened=group.filter(c=>expanded.has(c.id));let cursor=0;
  const assign=(cross:typeof group[number],x:number,rootY:number)=>{const fullHeight=GRAPH_NODE_HEIGHT+(cross.rows-1)*CROSS_ROW;for(const node of cross.nodes)positions[node.id]={x:x+node.x,y:rootY+node.y};lanes[cross.id]={id:cross.id,area:String(slot),x:x-12,y:rootY-12,width:Math.max(...cross.nodes.map(n=>n.x))+GRAPH_NODE_WIDTH+24,height:fullHeight+24,nodes:cross.nodes};};
  // Folded badges share one thin row; hidden descendants take no vertical space.
  for(const cross of folded){const badgeX=Math.max(cross.x+(GRAPH_NODE_WIDTH-CROSS_BADGE_WIDTH)/2,cursor);assign(cross,badgeX-(GRAPH_NODE_WIDTH-CROSS_BADGE_WIDTH)/2,top-(GRAPH_NODE_HEIGHT-CROSS_BADGE_HEIGHT)/2);cursor=badgeX+CROSS_BADGE_WIDTH+24;}
  if(folded.length&&opened.length)top+=CROSS_BADGE_HEIGHT+24;
  for(const cross of opened){assign(cross,cross.x,top);top+=height(cross)+24;}
 }
 for(const id of projection.visibleIds)if(!positions[id]){positions[id]={x:GRAPH_COLUMN,y};y+=GRAPH_ROW;mainIds.push(id);}
 return{positions,mainIds,crossOwners,lanes,input:{data,projection}};
}
export function layoutGraph(data:GraphData,projection:GraphProjection){return layoutQuestionRows(data,projection).positions;}

/** Reflow from active crossings, then draw in the shared canvas coordinate space. */
export function expandCrossRows(layout:QuestionRowLayout,expandedIds:Iterable<string>){
 const expanded=new Set([...expandedIds].filter(id=>layout.lanes[id]));
 if(layout.input)layout=layoutQuestionRows(layout.input.data,layout.input.projection,expanded);
 const positions={...layout.positions},displayIds=new Set(layout.mainIds),sizes:Record<string,{width:number;height:number}>={},bands:{id:string;x:number;y:number;width:number;height:number}[]=[];
 for(const lane of Object.values(layout.lanes)){
  displayIds.add(lane.id);
  if(expanded.has(lane.id)){for(const node of lane.nodes){displayIds.add(node.id);sizes[node.id]={width:GRAPH_NODE_WIDTH,height:GRAPH_NODE_HEIGHT};}bands.push({id:lane.id,x:lane.x,y:lane.y,width:lane.width,height:lane.height});}
  else{positions[lane.id]={x:positions[lane.id].x+(GRAPH_NODE_WIDTH-CROSS_BADGE_WIDTH)/2,y:positions[lane.id].y+(GRAPH_NODE_HEIGHT-CROSS_BADGE_HEIGHT)/2};sizes[lane.id]={width:CROSS_BADGE_WIDTH,height:CROSS_BADGE_HEIGHT};}
 }
 return{positions,displayIds,sizes,expanded,bands};
}
