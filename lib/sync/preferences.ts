import {useEffect,useState} from 'react';
import {readDraft,writeDraft} from '@/lib/draft-storage';
import {syncApi,updateSync,type Envelope} from './client';
export const SYNC_INTERVALS=[0,5,15,30,60] as const;
export type SyncInterval=typeof SYNC_INTERVALS[number];
const key='device:cloud-sync-interval:v1',event='wenjian:sync-interval';
let customized=false;
let current:SyncInterval=15,loaded=false,pending:Promise<SyncInterval>|null=null;
export async function loadSyncInterval(){if(loaded)return current;if(pending)return pending;pending=(async()=>{const saved=await readDraft<{minutes:number}|null>(key,null);if(saved&&SYNC_INTERVALS.includes(saved.minutes as SyncInterval)){current=saved.minutes as SyncInterval;customized=true;}loaded=true;window.dispatchEvent(new Event(event));return current;})();try{return await pending;}finally{pending=null;}}
export function reflectLegacyAuto(enabled:boolean|undefined){if(customized||!loaded||enabled===undefined)return;const value=enabled?15:0;if(current!==value){current=value;window.dispatchEvent(new Event(event));}}
export function getSyncInterval(){return current;}
export function subscribeSyncInterval(fn:()=>void){window.addEventListener(event,fn);return()=>window.removeEventListener(event,fn);}
export async function saveSyncInterval(minutes:SyncInterval){if(!SYNC_INTERVALS.includes(minutes))throw Error('请选择支持的同步间隔。');await loadSyncInterval();const previous=current;await writeDraft(key,{minutes});try{const snapshot=await syncApi<Envelope>('local');if(snapshot.sync&&snapshot.sync.enabled!==(minutes>0))await updateSync(sync=>({...sync,enabled:minutes>0}));}catch(error){await writeDraft(key,{minutes:previous});throw error;}current=minutes;customized=true;window.dispatchEvent(new Event(event));}
export function useSyncInterval(){const [minutes,setMinutes]=useState<SyncInterval>(current),[error,setError]=useState(''),[ready,setReady]=useState(loaded);useEffect(()=>{let active=true;const update=()=>{setMinutes(current);setReady(true);};const unsubscribe=subscribeSyncInterval(update);void loadSyncInterval().then(()=>{if(active)update();}).catch(()=>{if(active)setError('同步时间暂时无法读取，请重试。');});return()=>{active=false;unsubscribe();};},[]);return {minutes,ready,error};}
