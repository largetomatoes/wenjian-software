import {pdfSourceRange} from './pdf-source-range';
import {MARK_COLORS,markRgba} from './mark-colors.cjs';
type Mark={range?:Range;id:string;quote:string;rects?:{x:number;y:number;width:number;height:number}[];color?:string;kind?:'ordinary'|'process';at?:string};
const pages=new WeakMap<HTMLElement,{first:Node|null;text:string;cache:Map<string,Range>}>();
/** Cache source lookup independently of color. Split overlaps into disjoint
 * ranges so multiple records cannot build up an opaque background. */
export function paintSourceMarks(root:HTMLElement,name:string,marks:Mark[],rotation:number){
 const text=root.textContent||'';let page=pages.get(root);if(!page||page.first!==root.firstChild||page.text!==text){page={first:root.firstChild,text,cache:new Map()};pages.set(root,page);}
 const ranges:{id:string;range:Range;color?:string;priority:number;start:number;end:number}[]=[],wanted=new Set<string>();
 const offset=(node:Node,n:number)=>{const r=root.ownerDocument.createRange();r.selectNodeContents(root);r.setEnd(node,n);return r.toString().length;};
 for(const [index,mark]of marks.entries()){
  const key=JSON.stringify([mark.id,mark.quote,mark.rects,rotation]);wanted.add(key);let range=mark.range||page.cache.get(key);
  if(range&&(!root.contains(range.startContainer)||!root.contains(range.endContainer)))range=undefined;
  if(!range){range=pdfSourceRange(root,mark.quote,mark.rects,rotation)||undefined;if(range)page.cache.set(key,range);}
  if(range)ranges.push({id:mark.id,range,color:mark.color,priority:(mark.kind==='process'?1_000_000:0)+index,start:offset(range.startContainer,range.startOffset),end:offset(range.endContainer,range.endOffset)});
 }
 for(const key of page.cache.keys())if(!wanted.has(key))page.cache.delete(key);
 const doc=root.ownerDocument,registry=(doc.defaultView?.CSS as unknown as {highlights?:Map<string,unknown>})?.highlights,Ctor=(doc.defaultView as unknown as {Highlight?:new(...ranges:Range[])=>unknown})?.Highlight;
 if(!registry||!Ctor)return ranges;
 const styleId=name+'-style';let style=doc.getElementById(styleId);if(!style){style=doc.createElement('style');style.id=styleId;style.textContent=MARK_COLORS.map(c=>`::highlight(${name}-${c.id}){background:${markRgba(c.id)}}`).join('');doc.head.appendChild(style);}
 const nodes:Text[]=[],walker=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null;while((node=walker.nextNode()))nodes.push(node as Text);
 const point=(position:number)=>{let at=0;for(const n of nodes){if(at+n.length>=position)return {node:n,offset:position-at};at+=n.length;}return nodes.length?{node:nodes.at(-1)!,offset:nodes.at(-1)!.length}:null;};
 const points=[...new Set(ranges.flatMap(r=>[r.start,r.end]))].sort((a,b)=>a-b),painted=new Map<string,Range[]>();
 for(let i=0;i<points.length-1;i++){const start=points[i],end=points[i+1],winner=ranges.filter(r=>r.start<=start&&r.end>=end).sort((a,b)=>b.priority-a.priority)[0];if(!winner||end<=start)continue;const a=point(start),b=point(end);if(!a||!b)continue;const r=doc.createRange();r.setStart(a.node,a.offset);r.setEnd(b.node,b.offset);const color=MARK_COLORS.some(c=>c.id===winner.color)?winner.color!:'yellow',list=painted.get(color)||[];list.push(r);painted.set(color,list);}
 for(const color of MARK_COLORS){registry.delete(name+'-'+color.id);const list=painted.get(color.id);if(list?.length)registry.set(name+'-'+color.id,new Ctor(...list));}
 return ranges;
}
export function clearSourceMarks(root:HTMLElement|null,name:string){if(!root)return;const doc=root.ownerDocument,registry=(doc.defaultView?.CSS as unknown as {highlights?:Map<string,unknown>})?.highlights;for(const color of MARK_COLORS)registry?.delete(name+'-'+color.id);doc.getElementById(name+'-style')?.remove();pages.delete(root);}
