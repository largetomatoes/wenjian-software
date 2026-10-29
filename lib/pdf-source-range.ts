import {readingTextNodes,rangeForMatch} from './book-search';
import {textIndex,searchableText,rotateNormalizedRect} from './reader-text';
type Rect={x:number;y:number;width:number;height:number};
// Repeated passages are distinguished by the saved page-space anchor, not DOM order.
export function pdfSourceRange(root:HTMLElement,quote:string,rects:Rect[]|undefined,rotation:number):Range|null{
 const nodes=readingTextNodes(root),raw=nodes.map(node=>node.data).join(''),indexed=textIndex(raw),needle=searchableText(quote);if(!needle)return null;
 const candidates:Range[]=[];let from=0;
 while(candidates.length<200){const at=indexed.text.indexOf(needle,from);if(at<0)break;const range=rangeForMatch(nodes,indexed.offsets[at],indexed.offsets[at+needle.length-1]+1);if(range)candidates.push(range);from=at+needle.length;}
 if(!candidates.length)return null;if(!rects?.length||candidates.length===1)return candidates[0];
 const paper=root.closest('.pdf-page')?.getBoundingClientRect();if(!paper?.width||!paper.height)return candidates[0];const anchor=rotateNormalizedRect(rects[0],rotation),x=anchor.x+anchor.width/2,y=anchor.y+anchor.height/2;
 const distance=(range:Range)=>{const box=range.getBoundingClientRect();return ((box.left+box.width/2-paper.left)/paper.width-x)**2+((box.top+box.height/2-paper.top)/paper.height-y)**2;};
 return candidates.reduce((a,b)=>distance(a)<=distance(b)?a:b);
}
