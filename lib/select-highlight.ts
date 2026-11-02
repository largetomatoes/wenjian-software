export type MarkRange={id:string;range:Range;priority?:number};
type Click={clientX:number;clientY:number;button?:number;detail?:number;shiftKey?:boolean;altKey?:boolean;metaKey?:boolean;ctrlKey?:boolean;target:EventTarget|null};
export function hitHighlight(event:Click,ranges:MarkRange[]):MarkRange|null{
 if((event.button??0)!==0||(event.detail??1)>1||event.shiftKey||event.altKey||event.metaKey||event.ctrlKey)return null;
 const target=event.target as Element|null;if(target?.closest?.('button,a,input,textarea,select,[contenteditable=true],.process-note-rail,.zotero-note-rail'))return null;
 const doc=(target?.ownerDocument||ranges[0]?.range.startContainer.ownerDocument),selection=doc?.getSelection();
 // An actual drag/word selection must keep the user's chosen bounds.
 if(selection&&!selection.isCollapsed)return null;
 const hits=ranges.filter(mark=>!mark.range.collapsed&&Array.from(mark.range.getClientRects()).some(rect=>rect.width>0&&rect.height>0&&event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom));
 return hits.sort((a,b)=>(b.priority??0)-(a.priority??0)||a.range.toString().length-b.range.toString().length)[0]||null;
}
export function selectHighlightRange(range:Range){const doc=range.startContainer.ownerDocument;if(!doc||range.collapsed||range.endContainer.ownerDocument!==doc)return false;const selection=doc.getSelection();if(!selection)return false;selection.removeAllRanges();selection.addRange(range.cloneRange());return true;}
export function sameSelectedRange(selection:Selection|null,range:Range){if(!selection||selection.isCollapsed||!selection.rangeCount)return false;const current=selection.getRangeAt(0);return current.startContainer===range.startContainer&&current.startOffset===range.startOffset&&current.endContainer===range.endContainer&&current.endOffset===range.endOffset;}
