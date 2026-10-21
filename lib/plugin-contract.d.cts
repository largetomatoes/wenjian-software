export const API_VERSION:number,MAX_PACKAGE_BYTES:number;
export type ExternalPlugin={format:'wenjian-plugin';schema:1;manifest:{id:string;name:string;author:string;description:string;version:string;apiVersion:1;minAppBuild:number;kind:'external-tool';platforms:string[];permissions:string[];launch:{mode:'open'|'copy-selection-and-open';url:string};license:string;homepage?:string};readme:string};
export type SandboxPlugin={format:'wenjian-plugin';schema:2;manifest:Omit<ExternalPlugin['manifest'],'apiVersion'|'kind'|'launch'>&{apiVersion:2;kind:'sandbox';network:{local:string[];remote:string[]}};view:{html:string;css:string;js:string};readme:string};
export type PluginPackage=ExternalPlugin|SandboxPlugin;
export function validatePackage(value:unknown,build:number,platform?:string):PluginPackage;
export function externalUrl(value:unknown):string;
