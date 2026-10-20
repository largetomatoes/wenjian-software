export const API_VERSION:number,MAX_PACKAGE_BYTES:number;
export type ExternalPlugin={format:'wenjian-plugin';schema:1;manifest:{id:string;name:string;author:string;description:string;version:string;apiVersion:1;minAppBuild:number;kind:'external-tool';platforms:string[];permissions:string[];launch:{mode:'open'|'copy-selection-and-open';url:string};license:string;homepage?:string};readme:string};
export function validatePackage(value:unknown,build:number):ExternalPlugin;
export function externalUrl(value:unknown):string;
