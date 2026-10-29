'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {PaperCitation,BookThoughtSource} from '@/lib/notebook';
import {keywordCandidates} from '@/lib/reading-keywords.cjs';

type Props={citation:PaperCitation;source:BookThoughtSource;onChange:(parts:string[]|null)=>void};
export function ReadingCitationDisplay({citation,source,onChange}:Props){
 const quote=useRef<HTMLParagraphElement>(null),[selection,setSelection]=useState(''),[text,setText]=useState(citation.displayText||''),[error,setError]=useState('');
 const candidates=useMemo(()=>keywordCandidates(source.quote||''),[source.quote]);
 useEffect(()=>{setText(citation.displayText||'');setSelection('');setError('');},[citation.id,citation.displayText]);
 function apply(parts:string[]|null){try{onChange(parts);setError('');}catch(e){setError((e as Error).message);}}
 function toggle(word:string){const parts=citation.displayParts||[citation.displayText||''];apply(parts.includes(word)?parts.filter(p=>p!==word):[...parts.filter(Boolean),word]);}
 function readSelection(){const current=window.getSelection();if(!current?.rangeCount||current.isCollapsed||!quote.current?.contains(current.getRangeAt(0).commonAncestorContainer))return;setSelection(current.toString().trim());}
 return <div className="citation-display-editor">
  <p className="citation-display-quote" ref={quote} onMouseUp={readSelection} onKeyUp={readSelection}>{source.quote}</p>
  {selection&&<div className="citation-display-selection"><span>已选：{selection.length>28?selection.slice(0,28)+'…':selection}</span><button type="button" onPointerDown={e=>e.preventDefault()} onClick={()=>apply([selection])}>用这段文字显示</button><button type="button" onPointerDown={e=>e.preventDefault()} onClick={()=>apply([...(citation.displayParts||[citation.displayText||'']).filter(Boolean),selection])}>追加显示词</button></div>}
  <details className="citation-display-settings"><summary>显示文字 · {citation.displayText||'选择关键词'}</summary>
   <div className="citation-display-input"><input aria-label="摘录显示文字" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();apply(text.split('·'));}}}/><button type="button" onClick={()=>apply(text.split('·'))}>应用</button></div>
   {(['nouns','verbs'] as const).map(kind=>candidates[kind].length>0&&<div className="citation-display-candidates" key={kind}><small>{kind==='nouns'?'名词候选':'动词候选'}</small><div>{candidates[kind].map(word=><button type="button" key={word} aria-pressed={citation.displayParts?.includes(word)||false} onClick={()=>toggle(word)}>{word}</button>)}</div></div>)}
   <button type="button" className="citation-display-auto" onClick={()=>apply(null)}>使用自动选择</button>
  </details>
  {error&&<p className="citation-display-error" role="alert">{error}</p>}
 </div>;
}
