import type {ExternalPlugin} from './plugin-contract.cjs';
export type InstalledPlugin=ExternalPlugin&{enabled:boolean;installedAt:string;updatedAt:string;source:string;sha256:string};
export type MarketPlugin={id:string;name:string;author:string;description:string;version:string;minAppBuild:number;platforms:string[];url:string;sha256:string};
export type PluginStatus={build:number;apiVersion:number;installed:InstalledPlugin[];catalog:MarketPlugin[];notice?:string};
export async function pluginApi<T>(input?:Record<string,unknown>,query='',invoke=false):Promise<T>{const response=await fetch('/api/plugins'+(invoke?'/invoke':'')+query,input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:{cache:'no-store'}),result=await response.json() as T&{error?:string};if(!response.ok)throw Error(result.error||'插件操作未完成');return result as T;}
export const pluginPermissions:Record<string,string>={'external.open':'打开声明的外部工具','selection.read':'使用你主动选中的片段','clipboard.write':'将所选片段复制到剪贴板'};
