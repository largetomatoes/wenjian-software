import {GRAPH_NODE_WIDTH as W,GRAPH_NODE_HEIGHT as H,type GraphPosition} from './graph-layout';
import type {GraphEdge} from './graph-projection';
type Point=GraphPosition;
type Size={width:number;height:number};
type Box=Point&Size&{id:string};
type Port={at:Point;out:Point;side:number};
export type CrossNetwork={id:string;path:string;segments:{a:Point;b:Point}[];routes:{edgeId:string;from:string;points:Point[]}[];junction?:Point};
const same=(a:Point,b:Point)=>a.x===b.x&&a.y===b.y;
const distance=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
function simplify(points:Point[]){const result:Point[]=[];for(const p of points){if(result.length&&same(result[result.length-1],p))continue;while(result.length>1){const a=result[result.length-2],b=result[result.length-1];if((a.x===b.x&&b.x===p.x&&(b.y-a.y)*(p.y-b.y)>=0)||(a.y===b.y&&b.y===p.y&&(b.x-a.x)*(p.x-b.x)>=0))result.pop();else break;}result.push(p);}return result;}
function hits(a:Point,b:Point,box:Box,pad=0){return a.x===b.x?a.x>box.x-pad+.001&&a.x<box.x+box.width+pad-.001&&Math.max(a.y,b.y)>box.y-pad+.001&&Math.min(a.y,b.y)<box.y+box.height+pad-.001:a.y>box.y-pad+.001&&a.y<box.y+box.height+pad-.001&&Math.max(a.x,b.x)>box.x-pad+.001&&Math.min(a.x,b.x)<box.x+box.width+pad-.001;}
function clear(points:Point[],boxes:Box[],source:string,target:string){return points.every((p,i)=>!i||!boxes.some(box=>hits(points[i-1],p,box,box.id===source||box.id===target?0:4)));}
function port(box:Box,side:number,along?:number):Port{const at=side===0?{x:box.x+box.width,y:along??box.y+box.height/2}:side===1?{x:along??box.x+box.width/2,y:box.y+box.height}:side===2?{x:box.x,y:along??box.y+box.height/2}:{x:along??box.x+box.width/2,y:box.y};return{at,out:{x:at.x+(side===0?6:side===2?-6:0),y:at.y+(side===1?6:side===3?-6:0)},side};}
function score(points:Point[]){return points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0)+Math.max(0,points.length-2)*24;}

// Obstacle-boundary grid, used only if the short bracket encounters a card.
// Routing is memoized by the view; there is no timer or idle animation loop.
function gridRoute(a:Point,b:Point,boxes:Box[],source:string,target:string):Point[]|undefined{
 const left=Math.min(a.x,b.x)-W-36,right=Math.max(a.x,b.x)+W+36,top=Math.min(a.y,b.y)-H-36,bottom=Math.max(a.y,b.y)+H+36;
 const nearby=boxes.filter(r=>r.x<right&&r.x+r.width>left&&r.y<bottom&&r.y+r.height>top);
 const xs=[...new Set([a.x,b.x,left,right,...nearby.flatMap(r=>[r.x-6,r.x+r.width+6])])].sort((a,b)=>a-b),ys=[...new Set([a.y,b.y,top,bottom,...nearby.flatMap(r=>[r.y-6,r.y+r.height+6])])].sort((a,b)=>a-b);
 if(xs.length*ys.length>60000)return undefined;
 const width=xs.length,start=(ys.indexOf(a.y)*width+xs.indexOf(a.x))*2,goal=ys.indexOf(b.y)*width+xs.indexOf(b.x),dist=new Map<number,number>([[start,0]]),prev=new Map<number,number>(),heap:{id:number;cost:number}[]=[];
 function push(item:{id:number;cost:number}){heap.push(item);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].cost<=item.cost)break;heap[i]=heap[p];i=p;}heap[i]=item;}
 function pop(){const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].cost<heap[c].cost)c++;if(heap[c].cost>=last.cost)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;}
 push({id:start,cost:distance(a,b)});const done=new Set<number>(),blocked=new Map<string,boolean>();
 while(heap.length){const current=pop();if(done.has(current.id))continue;done.add(current.id);const cell=current.id>>1,dir=current.id&1,ix=cell%width,iy=Math.floor(cell/width),p={x:xs[ix],y:ys[iy]};if(cell===goal){const points:Point[]=[];let id:number|undefined=current.id;while(id!==undefined){const c=id>>1;points.push({x:xs[c%width],y:ys[Math.floor(c/width)]});id=prev.get(id);}return simplify(points.reverse());}
  for(const[nx,ny,nd]of [[ix-1,iy,0],[ix+1,iy,0],[ix,iy-1,1],[ix,iy+1,1]]){if(nx<0||ny<0||nx>=width||ny>=ys.length)continue;const nextCell=ny*width+nx,id=nextCell*2+nd,q={x:xs[nx],y:ys[ny]},key=Math.min(cell,nextCell)+':'+Math.max(cell,nextCell);let hit=blocked.get(key);if(hit===undefined){hit=nearby.some(r=>hits(p,q,r,r.id===source||r.id===target?0:4));blocked.set(key,hit);}if(hit)continue;const cost=dist.get(current.id)!+distance(p,q)+(dir!==nd?24:0);if(cost>=(dist.get(id)??Infinity))continue;dist.set(id,cost);prev.set(id,current.id);push({id,cost:cost+distance(q,b)});}
 }
 return undefined;
}
function fallback(source:Box,target:Box,boxes:Box[],preferred:Point[],hasChildren:boolean):Point[]{
 const dy=target.y+target.height/2-source.y-source.height/2,rightY=hasChildren?source.y+(dy<0?18:source.height-18):undefined;
 const starts=[port(source,0,rightY),port(source,1),port(source,3),port(source,2)],ends=[port(target,2),port(target,3),port(target,1),port(target,0)];
 const pairs=starts.flatMap(a=>ends.map(b=>({a,b,bias:(a.side===2?90:0)+(b.side===0?48:0)+(a.side===(Math.abs(dy)>source.height?(dy>0?1:3):0)?0:16),length:distance(a.at,b.at)}))).sort((a,b)=>a.length+a.bias-b.length-b.bias);
 let best:Point[]|undefined,bestScore=Infinity;
 for(const{a,b,bias}of pairs){const x=(a.out.x+b.out.x)/2,y=(a.out.y+b.out.y)/2;const options=[...[a.out.x,b.out.x,x,Math.min(a.out.x,b.out.x)-24,Math.max(a.out.x,b.out.x)+24].map(x=>[a.out,{x,y:a.out.y},{x,y:b.out.y},b.out]),...[a.out.y,b.out.y,y,Math.min(a.out.y,b.out.y)-24,Math.max(a.out.y,b.out.y)+24].map(y=>[a.out,{x:a.out.x,y},{x:b.out.x,y},b.out])];for(const middle of options){const points=simplify([a.at,...middle,b.at]),cost=score(points)+bias;if(cost<bestScore&&clear(points,boxes,source.id,target.id)){best=points;bestScore=cost;}}}
 if(best)return best;
 for(const{a,b}of pairs){const middle=gridRoute(a.out,b.out,boxes,source.id,target.id);if(middle){const points=simplify([a.at,...middle,b.at]);if(clear(points,boxes,source.id,target.id))return points;}}
 // Never silently draw a diagonal through another question's text.
 return clear(preferred,boxes,source.id,target.id)?preferred:[];
}
function mergedSegments(routes:CrossNetwork['routes']){const groups=new Map<string,{vertical:boolean;fixed:number;spans:[number,number][]}>();for(const route of routes)for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i];if(same(a,b))continue;const vertical=a.x===b.x,fixed=vertical?a.x:a.y,key=(vertical?'v':'h')+fixed;const group=groups.get(key)||{vertical,fixed,spans:[]};group.spans.push(vertical?[Math.min(a.y,b.y),Math.max(a.y,b.y)]:[Math.min(a.x,b.x),Math.max(a.x,b.x)]);groups.set(key,group);}
 const result:CrossNetwork['segments']=[];for(const g of groups.values()){g.spans.sort((a,b)=>a[0]-b[0]);const spans:[number,number][]=[];for(const span of g.spans){const last=spans.at(-1);if(last&&span[0]<=last[1])last[1]=Math.max(last[1],span[1]);else spans.push([...span]);}for(const[a,b]of spans)result.push(g.vertical?{a:{x:g.fixed,y:a},b:{x:g.fixed,y:b}}:{a:{x:a,y:g.fixed},b:{x:b,y:g.fixed}});}return result;
}
/** One orthogonal network per crossing; common stems are painted once. */
export function crossNetworks(edges:GraphEdge[],positions:Record<string,Point>,sizes:Record<string,Size>={},visibleIds:Iterable<string>=Object.keys(positions)):CrossNetwork[]{
 const box=(id:string):Box=>({id,...positions[id],width:sizes[id]?.width||W,height:sizes[id]?.height||H}),boxes=[...visibleIds].filter(id=>positions[id]).map(box),groups=new Map<string,GraphEdge[]>();
 for(const e of edges)if(e.kind==='cross'&&positions[e.from]&&positions[e.to])groups.set(e.to,[...(groups.get(e.to)||[]),e]);
 const result:CrossNetwork[]=[];
 for(const[id,connections]of groups){const target=box(id),vertical=target.height>target.width,allLeft=!vertical&&connections.every(e=>box(e.from).x+box(e.from).width<target.x-12),bus=allLeft?Math.min(target.x-24,Math.max(...connections.map(e=>box(e.from).x+box(e.from).width))+24):0,junction=allLeft?{x:bus,y:target.y+target.height/2}:undefined,routes:CrossNetwork['routes']=[];
  for(const edge of connections){let source=box(edge.from);const drawn=boxes.find(b=>b.x===source.x&&b.y===source.y&&b.width===source.width&&b.height===source.height);if(drawn)source={...source,id:drawn.id};if(source.x===target.x&&source.y===target.y)continue;const hasChildren=edges.some(e=>e.kind==='hierarchy'&&e.from===edge.from),sy=source.y+source.height/2,ty=target.y+target.height/2;let points:Point[];
   if(junction){const y=hasChildren?source.y+(ty<sy?18:source.height-18):sy;points=[{x:source.x+source.width,y},{x:bus,y},junction,{x:target.x,y:junction.y}];}
   else if(vertical&&source.x+source.width<=target.x){const x=target.x+target.width/2;if(source.y+source.height<=target.y)points=[{x:source.x+source.width,y:sy},{x,y:sy},{x,y:target.y}];else if(source.y>=target.y+target.height)points=[{x:source.x+source.width,y:sy},{x,y:sy},{x,y:target.y+target.height}];else{const y=(Math.max(source.y+10,target.y)+Math.min(source.y+source.height-10,target.y+target.height))/2;points=[{x:source.x+source.width,y},{x:target.x,y}];}}
   else if(Math.min(source.x+source.width,target.x+target.width)-Math.max(source.x,target.x)>=28&&(source.y+source.height<=target.y||target.y+target.height<=source.y)){const x=clamp(target.x+target.width/2,Math.max(source.x,target.x)+12,Math.min(source.x+source.width,target.x+target.width)-12),below=source.y<target.y;points=[{x,y:below?source.y+source.height:source.y},{x,y:below?target.y:target.y+target.height}];}
   else points=[];
   points=simplify(points);if(!points.length||!clear(points,boxes,source.id,target.id))points=fallback(source,target,boxes,points,hasChildren);routes.push({edgeId:edge.id,from:edge.from,points});
  }
  const segments=mergedSegments(routes),path=segments.map(s=>`M${s.a.x} ${s.a.y} L${s.b.x} ${s.b.y}`).join(' ');result.push({id,path,segments,routes,junction});
 }
 return result;
}
export function hierarchyPath(a:Point,b:Point,crossTree=false){const ax=a.x+W,bx=b.x,ay=a.y+H/2,by=b.y+H/2,mid=(ax+bx)/2;if(crossTree){const joint=bx-36;return ay===by?`M${ax} ${ay} L${bx} ${by}`:`M${ax} ${ay} L${joint} ${ay} L${joint} ${by} L${bx} ${by}`;}return `M${ax} ${ay} C${mid} ${ay},${mid} ${by},${bx} ${by}`;}
export function crossRoutes(edges:GraphEdge[],positions:Record<string,Point>,sizes:Record<string,Size>={}){return new Map(crossNetworks(edges,positions,sizes).flatMap(n=>n.routes.map(r=>[r.edgeId,r.points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ')] as const)));}
export function crossJunctions(edges:GraphEdge[],positions:Record<string,Point>,sizes:Record<string,Size>={}){return crossNetworks(edges,positions,sizes).flatMap(n=>n.junction?[{id:n.id,...n.junction,endX:positions[n.id].x}]:[]);}
