import {markColor} from './mark-colors.cjs';
import {paintSourceMarks,clearSourceMarks} from './source-mark-painter';
/** Own the visible marks, not epub.js's global annotation registry. That registry
 * duplicates an index when the same CFI is added twice and leaves stale hashes
 * when an annotation is removed while no view exists. */
export type EpubHighlightRendition={book?:any;views?:()=>any[]|{all:()=>any[]};getContents?:()=>any[];on?:(event:string,fn:(...args:any[])=>void)=>void;off?:(event:string,fn:(...args:any[])=>void)=>void};
const CLASS='wenjian-process-highlight';
export function createEpubHighlights(rendition:EpubHighlightRendition,{schedule=cb=>requestAnimationFrame(cb),cancel=id=>cancelAnimationFrame(id),onUnresolved=()=>{},onActivate}:{schedule?:(cb:()=>void)=>number;cancel?:(id:number)=>void;onUnresolved?:(count:number)=>void;onActivate?:(cfi:string,event:MouseEvent|TouchEvent)=>void}={}){
 let disposed=false,frame:number|null=null,locations=new Map<string,{color?:string;kind?:'ordinary'|'process'}>(),lastErrors=-1;
 const painted=new Map<any,{document:Document;marks:Map<string,any>;styles:Map<string,string>}>();
 const remove=(view:any,cfi:string,mark:any)=>{try{if(view.highlights?.[cfi]?.mark===mark)view.unhighlight(cfi);}catch{/* The old iframe may already have been destroyed. */}};
 function clear(view:any){if(view.contents?.document?.body)clearSourceMarks(view.contents.document.body,CLASS);const row=painted.get(view);if(row)for(const [cfi,mark] of row.marks)remove(view,cfi,mark);painted.delete(view);}
 function refresh(){
  if(disposed)return;
  const collection=rendition.views?.(),views=Array.isArray(collection)?collection:collection?.all?.()||[],active=new Set(views);let unresolved=0;
  for(const view of painted.keys())if(!active.has(view))clear(view);
  for(const view of views){
   if(!view.contents?.document)continue;
   let row=painted.get(view);if(row&&row.document!==view.contents.document){clear(view);row=undefined;}
   if(!row){row={document:view.contents.document,marks:new Map(),styles:new Map()};painted.set(view,row);const fonts=view.contents.document.fonts;void fonts?.ready?.then(()=>{if(!disposed&&painted.has(view))request();},()=>{});}
   const wanted=new Set<string>();
   for(const cfi of locations.keys()){try{const section=rendition.book?.spine?.get(cfi);if(section?.index===view.index)wanted.add(cfi);}catch{unresolved++;}}
   if(view.contents?.range&&view.contents.document.defaultView?.CSS?.highlights){
    const marks=[];for(const cfi of wanted)try{const range=view.contents.range(cfi);if(range&&!range.collapsed)marks.push({id:cfi,quote:range.toString(),range,...locations.get(cfi)});}catch{unresolved++;}
    paintSourceMarks(view.contents.document.body,CLASS,marks,0);continue;
   }
   for(const [cfi,mark] of row.marks)if(!wanted.has(cfi)){remove(view,cfi,mark);row.marks.delete(cfi);}
   for(const cfi of wanted){
    const color=markColor(locations.get(cfi)?.color).hex,mark=row.marks.get(cfi);if(mark&&view.highlights?.[cfi]?.mark===mark&&row.styles.get(cfi)===color)continue;if(mark)remove(view,cfi,mark);
    try{const next=view.highlight(cfi,{},onActivate?(event:MouseEvent|TouchEvent)=>onActivate(cfi,event):undefined,CLASS,{'fill':color,'fill-opacity':'0.3','mix-blend-mode':'multiply'});if(next){row.marks.set(cfi,next);row.styles.set(cfi,color);}else unresolved++;}catch{unresolved++;}
   }
   try{view.pane?.render?.();}catch{/* A closing view is painted by its replacement. */}
  }
  if(unresolved!==lastErrors){lastErrors=unresolved;onUnresolved(unresolved);}
 }
 function request(){if(disposed||frame!==null)return;frame=schedule(()=>{frame=null;refresh();});}
 for(const event of ['rendered','relocated','resized','displayed'])rendition.on?.(event,request);
 return {setLocations(next:Iterable<string>){locations=new Map([...next].filter(cfi=>cfi?.startsWith('epubcfi(')).map(cfi=>[cfi,{}]));request();},setMarks(next:Array<{cfi:string;color?:string;kind?:'ordinary'|'process'}>){locations=new Map(next.filter(m=>m.cfi?.startsWith('epubcfi(')).map(m=>[m.cfi,{color:m.color,kind:m.kind}]));request();},refresh,dispose(){if(disposed)return;disposed=true;if(frame!==null)cancel(frame);for(const event of ['rendered','relocated','resized','displayed'])rendition.off?.(event,request);for(const view of painted.keys())clear(view);locations.clear();}};
}
