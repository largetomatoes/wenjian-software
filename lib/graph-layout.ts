import {ROOT} from './notebook';
import {graphOwners,type GraphProjection,type GraphData} from './graph-projection';
export type GraphPosition={x:number;y:number};
export const GRAPH_NODE_WIDTH=260,GRAPH_NODE_HEIGHT=84,GRAPH_COLUMN=308,GRAPH_ROW=144;
export const CROSS_BADGE_WIDTH=198,CROSS_BADGE_HEIGHT=30;
export const CROSS_VERTICAL_WIDTH=32,CROSS_VERTICAL_HEIGHT=76;
const CROSS_ROW=120;
export type CrossBadge={x:number;y:number;width:number;height:number;orientation:'horizontal'|'vertical';nearId?:string};
export type CrossLane={id:string;area:string;x:number;y:number;width:number;height:number;nodes:{id:string;x:number;y:number;parent:string|null}[]};
export type QuestionRowLayout={positions:Record<string,GraphPosition>;mainIds:string[];crossOwners:Record<string,string>;lanes:Record<string,CrossLane>;badges:Record<string,CrossBadge>;input?:{data:GraphData;projection:GraphProjection}};

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
 // Use the actual vacant gap, rather than moving every crossing one column
 // beyond its deepest source. A centre already occupied by a same-column
 // question gets a side marker and an opened tree in the adjacent column.
 function centreObstacle(id:string){const cross=crossMap.get(id),anchors=cross?.anchorIds.map(key=>ordinary[owners.get(key)||key]);if(!anchors?.length||anchors.some(p=>!p))return undefined;const first=anchors[0];if(anchors.some(p=>p.x!==first.x))return undefined;const row=anchors.reduce((sum,p)=>sum+p.row,0)/anchors.length;return mainIds.find(key=>key!==rootId&&ordinary[key].x===first.x&&Math.abs(ordinary[key].row-row)<.01);}
 function sourceX(key:string,seen=new Set<string>()):number{key=owners.get(key)||key;if(ordinary[key])return ordinary[key].x;if(seen.has(key))return GRAPH_COLUMN;if(xMemo.has(key))return xMemo.get(key)!;const next=new Set([...seen,key]),note=notes.get(key),cross=crossMap.get(key);const value=note?.parent?sourceX(note.parent,next)+GRAPH_COLUMN:cross?.anchorIds.length?Math.max(...cross.anchorIds.map(id=>sourceX(id,next)))+(centreObstacle(key)?GRAPH_COLUMN:0):GRAPH_COLUMN;xMemo.set(key,value);return value;}
 const groups=new Map<number,{id:string;x:number;rows:number;nodes:CrossLane['nodes']}[]>();
 for(const cross of crosses){
  const row=sourceRow(cross.id),slot=rowIds.reduce((best,r)=>Math.abs(r+.5-row)<Math.abs(best+.5-row)?r:best,rowIds[0]);
  const nodes:CrossLane['nodes']=[{id:cross.id,x:0,y:0,parent:null}],seen=new Set([cross.id]);
  const descend=(parent:string,depth:number,start:number)=>{let next=start;for(const child of children.get(parent)||[]){if(seen.has(child)||crossOwners[child]!==cross.id)continue;seen.add(child);nodes.push({id:child,parent,x:depth*GRAPH_COLUMN,y:next*CROSS_ROW});descend(child,depth+1,next);next+=count(child);}};
  descend(cross.id,1,0);const group=groups.get(slot)||[];group.push({id:cross.id,x:sourceX(cross.id),rows:count(cross.id),nodes});groups.set(slot,group);
 }
 const height=(cross:{id:string;rows:number})=>expanded.has(cross.id)?GRAPH_NODE_HEIGHT+(cross.rows-1)*CROSS_ROW:CROSS_BADGE_HEIGHT;
 const visibleHeight=(row:number)=>{const group=groups.get(row)||[],opened=group.filter(c=>expanded.has(c.id)),folded=group.some(c=>!expanded.has(c.id));return opened.reduce((sum,c)=>sum+height(c),0)+(folded?CROSS_BADGE_HEIGHT:0)+Math.max(0,opened.length+(folded?1:0)-1)*24;};
 const step=(row:number)=>Math.max(GRAPH_ROW,GRAPH_NODE_HEIGHT+24+visibleHeight(row));
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
 const badges:Record<string,CrossBadge>={};
 for(const cross of crosses)if(!expanded.has(cross.id)){const p=positions[cross.id];badges[cross.id]={x:p.x+(GRAPH_NODE_WIDTH-CROSS_BADGE_WIDTH)/2,y:p.y+(GRAPH_NODE_HEIGHT-CROSS_BADGE_HEIGHT)/2,width:CROSS_BADGE_WIDTH,height:CROSS_BADGE_HEIGHT,orientation:'horizontal'};}
 // The upper-right corner leaves the ordinary question's centre exit free.
 // Check real rectangles: a busy gutter falls back to the vacant horizontal
 // gap instead of stacking vertical badges or covering a neighbouring card.
 for(const cross of crosses){const nearId=centreObstacle(cross.id);if(!badges[cross.id]||!nearId)continue;const p=positions[nearId],candidate:CrossBadge={x:p.x+GRAPH_NODE_WIDTH+8,y:p.y+GRAPH_NODE_HEIGHT/2-CROSS_VERTICAL_HEIGHT-10,width:CROSS_VERTICAL_WIDTH,height:CROSS_VERTICAL_HEIGHT,orientation:'vertical',nearId};const overlap=(b:{x:number;y:number;width:number;height:number})=>candidate.x<b.x+b.width+3&&candidate.x+candidate.width+3>b.x&&candidate.y<b.y+b.height+3&&candidate.y+candidate.height+3>b.y;
  if(mainIds.some(id=>overlap({...positions[id],width:GRAPH_NODE_WIDTH,height:GRAPH_NODE_HEIGHT}))||Object.values(lanes).some(lane=>expanded.has(lane.id)&&lane.nodes.some(n=>overlap({...positions[n.id],width:GRAPH_NODE_WIDTH,height:GRAPH_NODE_HEIGHT})))||Object.entries(badges).some(([id,b])=>id!==cross.id&&overlap(b)))continue;
  badges[cross.id]=candidate;
 }
 return{positions,mainIds,crossOwners,lanes,badges,input:{data,projection}};
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
  else{const badge=layout.badges[lane.id];positions[lane.id]={x:badge.x,y:badge.y};sizes[lane.id]={width:badge.width,height:badge.height};}
 }
 return{positions,displayIds,sizes,expanded,bands,badges:layout.badges};
}
