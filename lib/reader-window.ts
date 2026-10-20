/** Closing a full-screen reader must not restore focus to detached PDF text or
 * scroll the graph to a previously focused offscreen SVG node. */
export function readerClosedFocus(event:Event){
 event.preventDefault();
 requestAnimationFrame(()=>{
  if(document.querySelector('[role="dialog"][data-state="open"]'))return;
  document.querySelector<HTMLElement>('.studio-header .library-jump')?.focus({preventScroll:true});
  window.dispatchEvent(new Event('wenjian:reader-closed'));
 });
}
