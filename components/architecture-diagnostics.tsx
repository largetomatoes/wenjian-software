'use client';
import {useEffect,useState} from 'react';
import './architecture-diagnostics.css';
export function ArchitectureDiagnostics(){
 const [open,setOpen]=useState(false),[report,setReport]=useState<Record<string,unknown>|null>(null),[error,setError]=useState('');
 useEffect(()=>{const samples:Array<Record<string,number|string>>=[];const record=(event:Event)=>{samples.push((event as CustomEvent).detail);if(samples.length>200)samples.shift();};window.addEventListener('wenjian:performance-sample',record);(window as unknown as {__wenjianPerformanceSamples:unknown}).__wenjianPerformanceSamples=samples;return()=>window.removeEventListener('wenjian:performance-sample',record);},[]);
 async function inspect(){setOpen(true);setError('');try{const r=await fetch('/api/architecture/metrics');if(!r.ok)throw Error('暂时无法读取诊断');setReport(await r.json());}catch(e){setError((e as Error).message);}}
 return <><div className="architecture-trial-badge">架构试用 · 独立本地资料<button type="button" onClick={()=>void inspect()}>诊断</button></div>{open&&<div className="architecture-diagnostics" role="dialog" aria-label="架构试用诊断"><h2>独立试用诊断</h2><p>本版本不连接正式云库，不会替换正式问间。退出后试用资料保留。</p>{error&&<p role="alert">{error}</p>}<pre>{report?JSON.stringify(report,null,2):'读取中…'}</pre><button type="button" onClick={()=>setOpen(false)}>返回试用</button></div>}</>;
}
