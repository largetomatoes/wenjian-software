/** Own the visible marks, not epub.js's global annotation registry. That registry
 * duplicates an index when the same CFI is added twice and leaves stale hashes
 * when an annotation is removed while no view exists. */
export type EpubHighlightRendition={book?:any;views?:()=>any[]|{all:()=>any[]};getContents?:()=>any[];on?:(event:string,fn:(...args:any[])=>void)=>void;off?:(event:string,fn:(...args:any[])=>void)=>void};
const CLASS='wenjian-process-highlight';
export function createEpubHighlights(rendition:EpubHighlightRendition,{schedule=cb=>requestAnimationFrame(cb),cancel=id=>cancelAnimationFrame(id),onUnresolved=()=>{}}:{schedule?:(cb:()=>void)=>number;cancel?:(id:number)=>void;onUnresolved?:(count:number)=>void}={}){
 let disposed=false,frame:number|null=null,locations=new Set<string>(),lastErrors=-1;
 const painted=new Map<any,{document:Document;marks:Map<string,any>}>();
 const remove=(view:any,cfi:string,mark:any)=>{try{if(view.highlights?.[cfi]?.mark===mark)view.unhighlight(cfi);}catch{/* The old iframe may already have been destroyed. */}};
 function clear(view:any){const row=painted.get(view);if(row)for(const [cfi,mark] of row.marks)remove(view,cfi,mark);painted.delete(view);}
 function refresh(){
  if(disposed)return;
  const collection=rendition.views?.(),views=Array.isArray(collection)?collection:collection?.all?.()||[],active=new Set(views);let unresolved=0;
  for(const view of painted.keys())if(!active.has(view))clear(view);
  for(const view of views){
   if(!view.contents?.document)continue;
   let row=painted.get(view);if(row&&row.document!==view.contents.document){clear(view);row=undefined;}
   if(!row){row={document:view.contents.document,marks:new Map()};painted.set(view,row);const fonts=view.contents.document.fonts;void fonts?.ready?.then(()=>{if(!disposed&&painted.has(view))request();},()=>{});}
   const wanted=new Set<string>();
   for(const cfi of locations){try{const section=rendition.book?.spine?.get(cfi);if(section?.index===view.index)wanted.add(cfi);}catch{unresolved++;}}
   for(const [cfi,mark] of row.marks)if(!wanted.has(cfi)){remove(view,cfi,mark);row.marks.delete(cfi);}
   for(const cfi of wanted){
    const mark=row.marks.get(cfi);if(mark&&view.highlights?.[cfi]?.mark===mark)continue;
    try{const next=view.highlight(cfi,{},undefined,CLASS,{'fill':'#f2dfa0','fill-opacity':'0.3','mix-blend-mode':'multiply'});if(next)row.marks.set(cfi,next);else unresolved++;}catch{unresolved++;}
   }
   try{view.pane?.render?.();}catch{/* A closing view is painted by its replacement. */}
  }
  if(unresolved!==lastErrors){lastErrors=unresolved;onUnresolved(unresolved);}
 }
 function request(){if(disposed||frame!==null)return;frame=schedule(()=>{frame=null;refresh();});}
 for(const event of ['rendered','relocated','resized','displayed'])rendition.on?.(event,request);
 return {setLocations(next:Iterable<string>){locations=new Set([...next].filter(cfi=>cfi?.startsWith('epubcfi(')));request();},refresh,dispose(){if(disposed)return;disposed=true;if(frame!==null)cancel(frame);for(const event of ['rendered','relocated','resized','displayed'])rendition.off?.(event,request);for(const view of painted.keys())clear(view);locations.clear();}};
}
