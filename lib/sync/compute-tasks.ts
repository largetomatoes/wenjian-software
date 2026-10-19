import {capture,materialize,project,unionOperations,conflictsOnly,type SyncState,type Operation} from './core';
import {jsonEqual} from '../value-equal';
import type {Notebook} from '../notebook';
// Pure calculations shared by the worker and the existing non-Windows path.
export const calculations={
 serialize:({value}:{value:unknown})=>JSON.stringify(value),
 parse:({text}:{text:string})=>JSON.parse(text) as unknown,
 capture:({state,data}:{state:SyncState;data:Notebook})=>capture(state,data),
 materialize:({state,data}:{state:SyncState;data:Notebook})=>materialize(state,data),
 project:({data}:{data:Notebook})=>project(data),
 unchanged:({state,data}:{state:SyncState;data:Notebook})=>!state.pending.length&&jsonEqual(project(data),state.observed),
 summary:({state,data}:{state:SyncState;data:Notebook})=>({conflicts:conflictsOnly(state),changed:!!state.pending.length||!jsonEqual(project(data),state.observed)}),
 validate:({state,data,remote}:{state:SyncState;data:Notebook;remote:Operation[]})=>{materialize({...state,operations:unionOperations(state.operations,remote)},data);return true;},
 finish:({state,data,remote,sent,received,epoch}:{state:SyncState;data:Notebook;remote:Operation[];sent:string[];received:string[];epoch:string})=>{
  let next=capture(state,data);const acknowledged=new Set(sent);
  next={...next,epoch,operations:unionOperations(next.operations,remote),pending:next.pending.filter(op=>!acknowledged.has(op.id)),received:[...new Set([...next.received,...received])],lastSync:new Date().toISOString()};
  const merged=materialize(next,data);next.observed=project(merged.data);return {data:merged.data,sync:next};
 }
};
export type Calculation=keyof typeof calculations;
export type Input<K extends Calculation>=Parameters<typeof calculations[K]>[0];
export type Output<K extends Calculation>=ReturnType<typeof calculations[K]>;
export function calculate<K extends Calculation>(task:K,input:Input<K>):Output<K>{return (calculations[task] as (value:Input<K>)=>Output<K>)(input);}
