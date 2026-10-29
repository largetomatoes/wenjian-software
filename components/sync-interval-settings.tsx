'use client';
import './sync-interval-settings.css';
import {useState} from 'react';
import {SYNC_INTERVALS,saveSyncInterval,useSyncInterval,type SyncInterval} from '@/lib/sync/preferences';
export function SyncIntervalSettings({disabled=false}:{disabled?:boolean}){const {minutes,ready,error:readError}=useSyncInterval();const [saving,setSaving]=useState(false),[error,setError]=useState('');return <div className="sync-interval-setting"><label><span>自动同步</span><select aria-label="自动同步间隔" disabled={disabled||saving||!ready} value={minutes} onChange={async e=>{const value=Number(e.target.value) as SyncInterval;setSaving(true);setError('');try{await saveSyncInterval(value);}catch{setError('同步时间未能保存，请重试。');}finally{setSaving(false);}}}>{SYNC_INTERVALS.map(n=><option key={n} value={n}>{n?`每 ${n} 分钟`:'仅手动同步'}</option>)}</select></label><p>本机自动保存照常进行。定时同步在前台空闲时检查笔记与书籍；也可随时点击“立即同步”。此设置仅影响当前设备。</p>{(error||readError)&&<p role="alert">{error||readError}</p>}</div>;}
