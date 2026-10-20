'use client';

import {useRef} from 'react';
import {BookOpen,Library} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import './library-entry.css';

type Props={open:boolean;onOpenChange:(open:boolean)=>void;disabled:boolean;onChoose:(mode:'reading'|'zotero')=>void};

export function LibraryEntry({open,onOpenChange,disabled,onChoose}:Props){
 const choosing=useRef(false);const choose=(mode:'reading'|'zotero')=>{choosing.current=true;onChoose(mode);};
 return <Popover open={open} onOpenChange={onOpenChange}>
  <PopoverTrigger asChild><Button variant="outline" className="library-jump" aria-label="书库" title="书库" disabled={disabled}><Library/><span>书库</span></Button></PopoverTrigger>
  <PopoverContent className="library-entry-menu" align="start" sideOffset={9} aria-label="选择书库" onCloseAutoFocus={event=>{if(choosing.current)event.preventDefault();choosing.current=false;}}>
   <button type="button" onClick={()=>choose('reading')}><BookOpen aria-hidden="true"/><span>读书</span></button>
   <button type="button" onClick={()=>choose('zotero')}><span className="library-entry-zotero" aria-hidden="true">Z</span><span>Zotero</span></button>
  </PopoverContent>
 </Popover>;
}
