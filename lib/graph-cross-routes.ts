import {GRAPH_NODE_WIDTH as W,GRAPH_NODE_HEIGHT as H,type GraphPosition} from './graph-layout';
import type {GraphEdge} from './graph-projection';
// Distinct, ordered ports prevent shared anchors from drawing identical lines.
// A cross remains one junction with N spokes, regardless of its anchor count.
export function crossRoutes(edges:GraphEdge[],positions:Record<string,GraphPosition>,sizes:Record<string,{width:number;height:number}>={}){
 type Port={edge:string;end:'from'|'to';sort:number;side:'left'|'right'|'top'|'bottom'};
 const groups=new Map<string,Port[]>(),ports=new Map<string,{x:number;y:number;dx:number;dy:number}>();
 const routeEdges=edges.filter(e=>e.kind==='cross'&&positions[e.from]&&positions[e.to]);
 for(const edge of routeEdges)for(const end of ['from','to'] as const){const id=edge[end],p=positions[id],other=positions[edge[end==='from'?'to':'from']],dx=other.x-p.x,dy=other.y-p.y,side=Math.abs(dx)>(sizes[id]?.width||W)*.55?(dx>0?'right':'left'):(dy>0?'bottom':'top'),key=id+':'+side;groups.set(key,[...(groups.get(key)||[]),{edge:edge.id,end,sort:side==='left'||side==='right'?other.y:other.x,side}]);}
 for(const [key,items] of groups){const side=items[0].side,id=key.slice(0,-side.length-1),p=positions[id],w=sizes[id]?.width||W,h=sizes[id]?.height||H;items.sort((a,b)=>a.sort-b.sort||a.edge.localeCompare(b.edge));items.forEach((item,i)=>{const ratio=(i+1)/(items.length+1),horizontal=side==='left'||side==='right';ports.set(item.edge+':'+item.end,{x:p.x+(horizontal?(side==='right'?w:0):14+(w-28)*ratio),y:p.y+(horizontal?12+(h-24)*ratio:side==='bottom'?h:0),dx:side==='right'?1:side==='left'?-1:0,dy:side==='bottom'?1:side==='top'?-1:0});});}
 const result=new Map<string,string>();for(const edge of routeEdges){const a=ports.get(edge.id+':from')!,b=ports.get(edge.id+':to')!,bend=Math.max(30,Math.min(180,Math.hypot(a.x-b.x,a.y-b.y)*.35));result.set(edge.id,`M${a.x} ${a.y} C${a.x+a.dx*bend} ${a.y+a.dy*bend},${b.x+b.dx*bend} ${b.y+b.dy*bend},${b.x} ${b.y}`);}return result;
}
