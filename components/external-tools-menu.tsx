'use client';
import {useEffect,useState} from 'react';
import {DropdownMenuItem,DropdownMenuSeparator} from './ui/dropdown-menu';
import {pluginApi,type InstalledPlugin,type PluginStatus} from '@/lib/plugins-client';
export function ExternalToolsMenu({text,onNotice}:{text:string;onNotice:(value:string)=>void}){
 const [tools,setTools]=useState<InstalledPlugin[]>([]),[busy,setBusy]=useState(false);
 useEffect(()=>{if(document.documentElement.dataset.wenjianPlugins!=='true')return;let gone=false;void pluginApi<PluginStatus>().then(value=>{if(!gone)setTools(value.installed.filter(p=>p.enabled&&p.manifest.kind==='external-tool'));}).catch(()=>{});return()=>{gone=true;};},[]);
 if(typeof document==='undefined'||document.documentElement.dataset.wenjianPlugins!=='true')return null;
 return <><DropdownMenuSeparator/>{tools.map(p=><DropdownMenuItem key={p.manifest.id} disabled={busy} onSelect={()=>{setBusy(true);void pluginApi<{copied:boolean}>({id:p.manifest.id,text},'',true).then(result=>onNotice(result.copied?'已复制所选片段并打开外部工具，可自行粘贴。':'已打开外部工具。')).catch(e=>onNotice(e.message)).finally(()=>setBusy(false));}}>{p.manifest.name}</DropdownMenuItem>)}<DropdownMenuItem onSelect={()=>window.dispatchEvent(new Event('wenjian:plugins'))}>管理外部工具…</DropdownMenuItem></>;
}
