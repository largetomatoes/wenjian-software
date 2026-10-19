'use client';
import {useEffect,useState} from 'react';
import {Monitor} from 'lucide-react';
import {isWindowsReader} from '@/lib/windows-reader-performance';
import {SettingsRow} from './settings-row';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {Button} from './ui/button';
type Preference={hardwareAcceleration:boolean;active:boolean;restartRequired:boolean;warning:string};
export function WindowsPerformanceSettings(){
 const [visible,setVisible]=useState(false),[open,setOpen]=useState(false),[value,setValue]=useState<Preference|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>setVisible(isWindowsReader()),[]);
 useEffect(()=>{if(!open)return;let cancelled=false;setValue(null);setError('');void fetch('/api/app/performance').then(async response=>{const result=await response.json() as Preference & {error?:string};if(!response.ok)throw Error(result.error||'无法读取图形设置');if(!cancelled)setValue(result);}).catch(cause=>{if(!cancelled)setError(cause.message);});return()=>{cancelled=true;};},[open]);
 async function toggle(){if(!value||busy)return;setBusy(true);setError('');try{const response=await fetch('/api/app/performance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hardwareAcceleration:!value.hardwareAcceleration})});const next=await response.json() as Preference & {error?:string};if(!response.ok)throw Error(next.error||'设置未能保存');setValue(next);}catch(cause){setError((cause as Error).message);}finally{setBusy(false);}}
 if(!visible)return null;
 return <><SettingsRow title="图形硬件加速" description="默认关闭 · 可按电脑情况开启" icon={<Monitor size={19}/>} onClick={()=>setOpen(true)}/><Dialog open={open} onOpenChange={next=>{if(!busy)setOpen(next);}}><DialogContent><DialogTitle>图形硬件加速</DialogTitle><DialogDescription>开启后，问间会尝试使用显卡绘制界面和阅读页面。效果取决于显卡与驱动；若出现花屏、闪烁或卡顿，可关闭。此选项不会将 OCR 文字识别改为显卡运算。</DialogDescription><div className="flex items-center justify-between gap-4 py-3"><span>使用图形硬件加速</span><Button role="switch" aria-checked={value?.hardwareAcceleration??false} aria-label="使用图形硬件加速" disabled={!value||busy} variant={value?.hardwareAcceleration?'default':'outline'} onClick={()=>void toggle()}>{busy?'保存中…':value?.hardwareAcceleration?'已开启':'已关闭'}</Button></div>{value&&<p className="text-sm text-muted-foreground" role="status">{value.restartRequired?'已保存。请从系统托盘右键菜单选择“退出问间”，再重新打开，设置才会生效。若关闭按钮设为收起到托盘，关掉窗口不会退出程序。':`当前运行：${value.active?'已请求图形硬件加速':'图形硬件加速关闭'}。设置仅保存在这台电脑。`}</p>}{(error||value?.warning)&&<p role="alert">{error||value?.warning}</p>}<div className="flex justify-end"><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>完成</Button></div></DialogContent></Dialog></>;
}
