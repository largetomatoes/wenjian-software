const API_VERSION=2,MAX_PACKAGE_BYTES=1048576;
const permissions=['external.open','selection.read','clipboard.write'];
const sandboxPermissions=['notebook.read','graph.read','notebook.write','notebook.archive','notebook.delete','storage','network.local','network.remote','files.read','files.write','system.execute'];
function networkOrigin(value,local){const u=new URL(value);if(u.username||u.password||u.origin!==value||u.pathname!=='/'||u.search||u.hash)throw Error('网络地址请只填写协议、主机和端口。');const loop=['127.0.0.1','localhost','[::1]'].includes(u.hostname);if(local?(!loop||u.protocol!=='http:'):u.protocol!=='https:'||loop||/^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname))throw Error('本机服务使用本机 HTTP，远程服务使用 HTTPS。');return u.origin;}
function externalUrl(value){if(typeof value!=='string'||value.length>2048||/[\x00-\x20]/.test(value))throw Error('工具入口网址无效。');const u=new URL(value);if(u.username||u.password||!(u.protocol==='https:'||(u.protocol==='http:'&&['127.0.0.1','[::1]','localhost'].includes(u.hostname))))throw Error('工具入口应使用 HTTPS 或本机地址。');return u.toString();}
function validatePackage(value,build,platform='mac'){
 if(!value||value.format!=='wenjian-plugin'||![1,2].includes(value.schema)||!value.manifest)throw Error('不是有效的问间插件接入包。');
 const m=value.manifest;if(typeof m.id!=='string'||!/^([a-z0-9]+[.-])+[a-z0-9-]+$/.test(m.id)||m.id.length>100)throw Error('插件 ID 应为反向域名或分组名称。');
 for(const [k,max]of [['name',80],['author',100],['description',500]])if(typeof m[k]!=='string'||!m[k].trim()||m[k].length>max)throw Error('插件名称、作者或说明不完整。');
 const programmable=value.schema===2&&m.apiVersion===2&&m.kind==='sandbox';
 if(typeof m.version!=='string'||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(m.version)||!programmable&&!(value.schema===1&&m.apiVersion===1&&m.kind==='external-tool'))throw Error('插件类型与接口版本不匹配。');
 if(!Number.isSafeInteger(m.minAppBuild)||m.minAppBuild<(programmable?333:332)||m.minAppBuild>build)throw Error('插件需要更新版本的问间，或兼容构建号无效。');
 if(!['mac','windows','android','web'].includes(platform)||!Array.isArray(m.platforms)||!m.platforms.includes(platform)||m.platforms.some(x=>!['mac','windows','android','web'].includes(x)))throw Error('插件未声明兼容当前系统。');
 if(!Array.isArray(m.permissions)||m.permissions.some(p=>!(programmable?sandboxPermissions:permissions).includes(p))||new Set(m.permissions).size!==m.permissions.length||!programmable&&!m.permissions.includes('external.open'))throw Error('插件申请了当前不支持的权限。');
 if(programmable){
  if(typeof m.license!=='string'||!m.license.trim()||m.license.length>100)throw Error('请注明插件许可。');
  if(!value.view||['html','css','js'].some(k=>typeof value.view[k]!=='string')||value.view.html.length>200000||value.view.css.length>100000||value.view.js.length>500000)throw Error('插件需要有限大小的 HTML、CSS、JavaScript 页面。');
  if(value.code!==undefined||value.files!==undefined||m.entry!==undefined)throw Error('可编程插件只使用声明的沙箱页面。');
  if(value.readme!==undefined&&(typeof value.readme!=='string'||value.readme.length>64000))throw Error('插件说明过长。');
  const network={local:[],remote:[]};for(const k of ['local','remote']){const urls=m.network?.[k]||[];if(!Array.isArray(urls)||urls.length>12||new Set(urls).size!==urls.length)throw Error('网络地址声明无效。');if(urls.length&&!m.permissions.includes('network.'+k))throw Error('网络地址需要对应权限。');network[k]=urls.map(u=>networkOrigin(u,k==='local'));if(m.permissions.includes('network.'+k)&&!urls.length)throw Error('请声明允许访问的服务地址。');}
  return {format:'wenjian-plugin',schema:2,manifest:{id:m.id,name:m.name.trim(),author:m.author.trim(),description:m.description.trim(),version:m.version,apiVersion:2,minAppBuild:m.minAppBuild,kind:'sandbox',platforms:[...m.platforms],permissions:[...m.permissions],network,license:m.license.trim(),...(m.homepage?{homepage:externalUrl(m.homepage)}:{})},view:{html:value.view.html,css:value.view.css,js:value.view.js},readme:value.readme||''};
 }
 if(!m.launch||!['open','copy-selection-and-open'].includes(m.launch.mode))throw Error('外部工具启动方式无效。');
 if(m.launch.mode==='copy-selection-and-open'&&!['selection.read','clipboard.write'].every(p=>m.permissions.includes(p)))throw Error('复制选文需要声明选文和剪贴板权限。');
 const url=externalUrl(m.launch.url);if(typeof m.license!=='string'||!m.license.trim()||m.license.length>100)throw Error('请注明插件许可。');
 if(value.code!==undefined||m.entry!==undefined||value.files!==undefined)throw Error('当前接入包不执行脚本或二进制文件。');
 if(value.readme!==undefined&&(typeof value.readme!=='string'||value.readme.length>64000))throw Error('插件使用说明过长。');
 return {format:'wenjian-plugin',schema:1,manifest:{id:m.id,name:m.name.trim(),author:m.author.trim(),description:m.description.trim(),version:m.version,apiVersion:1,minAppBuild:m.minAppBuild,kind:'external-tool',platforms:[...m.platforms],permissions:[...m.permissions],launch:{mode:m.launch.mode,url},license:m.license.trim(),...(m.homepage?{homepage:externalUrl(m.homepage)}:{})},readme:value.readme||''};
}
module.exports={API_VERSION,MAX_PACKAGE_BYTES,validatePackage,externalUrl,sandboxPermissions,networkOrigin};
