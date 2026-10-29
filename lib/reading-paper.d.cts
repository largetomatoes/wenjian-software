import type {ReadingComposition,ReadingPaper,BookThoughtSource,PaperCitation} from './notebook';
export function paperOf(c:ReadingComposition,sources:BookThoughtSource[]):ReadingPaper;
export function projectPaper(c:ReadingComposition,p:ReadingPaper,sources:BookThoughtSource[]):ReadingComposition;
export function replaceBody(c:ReadingComposition,body:string,sources:BookThoughtSource[]):ReadingComposition;
export function insertCitation(c:ReadingComposition,id:string,offset:number,sources:BookThoughtSource[],kind?:'marker'|'quote',citationId?:string):{composition:ReadingComposition;citationId:string;caret:number};
export function removeCitation(c:ReadingComposition,id:string,sources:BookThoughtSource[]):ReadingComposition;
export function citationKind(c:ReadingComposition,id:string,kind:'marker'|'quote',sources:BookThoughtSource[]):ReadingComposition;
export function removeSource(c:ReadingComposition,id:string,sources:BookThoughtSource[]):ReadingComposition;
export function setRelation(c:ReadingComposition,ids:string[],label:string,text:string,sources:BookThoughtSource[],previousId?:string,at?:string):ReadingComposition;
export function flattenPaper(c:ReadingComposition):string;
export function validatePaper(c:ReadingComposition,s:BookThoughtSource[]):string;
export function numbers(p:ReadingPaper):Map<string,number>;

export function citationMarker(q:PaperCitation,p:ReadingPaper,order?:Map<string,number>):string;
export function withAutoDisplays(c:ReadingComposition,s:BookThoughtSource[]):ReadingComposition;
export function setCitationDisplay(c:ReadingComposition,id:string,parts:string[]|null,s:BookThoughtSource[]):ReadingComposition;
