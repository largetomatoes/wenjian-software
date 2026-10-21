export type Scope={pageIds:string[];bookIds:string[];cards:boolean;includeArchived:boolean};
export type RecordKind='question'|'cross'|'card'|'process'|'reading'|'highlight'|'book'|'reply'|'manuscript';
export type Operation=
 | {action:'update';kind:RecordKind;id:string;patch:Record<string,unknown>}
 | {action:'create';kind:'question';pageId:string;parentId:string;title:string;body?:string}
 | {action:'create';kind:'card';text:string;cardKind?:'idea'|'question'}
 | {action:'create';kind:'reading';libraryBookId:string;text:string;questionIds?:string[]}
 | {action:'cross';pageId:string;anchorIds:string[];title:string;text?:string}
 | {action:'link';from:string;to:string;type?:string}
 | {action:'move';pageId:string;recordId:string;parentId:string;beforeId?:string}
 | {action:'include';pageId:string;sourcePageId:string;recordId:string;parentId:string;withChildren?:boolean}
 | {action:'archive'|'restore'|'purge';kind:RecordKind;id:string};
export type Snapshot={schema:2;version:number;scope:Scope;data:Record<string,{id:string;[key:string]:unknown}[]>};
export type Graph={schema:2;version:number;nodes:{key:string;id:string;pageId:string;code:string;kind:string;title:string;parentId:string|null;order:number}[];edges:{from:string;to:string;fromKey?:string;toKey?:string;kind:string;pageId?:string;external?:boolean}[]};
export interface WenjianSDK {
 info():Promise<{apiVersion:2;pluginId:string;permissions:string[];scope:Scope;localProgram:string|null}>;
 notebook:{read():Promise<Snapshot>};graph:{read():Promise<Graph>};
 changes:{preview(operations:Operation[],reason:string):Promise<{token:string;version:number;summary:string[];destructive:boolean;expiresIn:number}>;apply(token:string):Promise<{saved:true;version:number;created:string[];recoveryId:string}>};
 storage:{get(key:string):Promise<unknown>;set(key:string,value:unknown):Promise<{saved:true}>};
 network:{request(options:{url:string;method?:'GET'|'POST';headers?:Record<string,string>;body?:string}):Promise<{status:number;contentType:string;body:string}>};
 files:{open():Promise<{name:string;text:string}|{cancelled:true}>;save(name:string,text:string):Promise<{saved:true}|{cancelled:true}>};
 system:{run(args?:string[],input?:string):Promise<{code:number|null;stdout:string;stderr:string}>};
}
declare global {interface Window {wenjian:WenjianSDK}}
