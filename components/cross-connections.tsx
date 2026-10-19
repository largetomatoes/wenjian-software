import {crossConnections} from '@/lib/question-links';
import {crossNumber,type Notebook,type CrossThought} from '@/lib/notebook';
import './cross-connections.css';
export function CrossConnections({data,cross,onOpen}:{data:Notebook;cross:CrossThought;onOpen?:(id:string)=>void}){
 const anchors=crossConnections(data,cross);return <section className="cross-connections" aria-label={`${crossNumber(cross)} 的全部关联问题`}><div className="cross-connections-hub"><strong>{crossNumber(cross)}</strong><span>同时关联 {anchors.length} 个问题</span></div><ul>{anchors.map(anchor=><li key={anchor.id}>{onOpen?<button type="button" onClick={()=>onOpen(anchor.id)}>{anchor.label}<span aria-hidden="true">↗</span></button>:<span>{anchor.label}</span>}</li>)}</ul></section>;
}
