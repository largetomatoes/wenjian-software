import {crossConnections} from '@/lib/question-links';
import {crossNumber,type Notebook,type CrossThought} from '@/lib/notebook';
import './cross-connections.css';
export function CrossConnections({data,cross,onOpen}:{data:Notebook;cross:CrossThought;onOpen?:(id:string)=>void}){
 const anchors=crossConnections(data,cross),groups=new Map<string,typeof anchors>();
 for(const a of anchors)groups.set(a.pageId,[...(groups.get(a.pageId)||[]),a]);
 return <section className="cross-connections" aria-label={`${crossNumber(cross,data)} 的全部关联问题`}>
  <div className="cross-connections-hub"><strong>{crossNumber(cross,data)}</strong><span>关联 {anchors.length} 个问题</span></div>
  <div className="cross-source-pages">{[...groups].map(([id,items])=><section key={id} className="cross-source-page"><h4>{items[0].pageTitle}</h4><ul>{items.map(anchor=><li key={anchor.id}>{onOpen?<button type="button" onClick={()=>onOpen(anchor.id)}>{anchor.label}<span aria-hidden="true">↗</span></button>:<span>{anchor.label}</span>}</li>)}</ul></section>)}</div>
 </section>;
}
