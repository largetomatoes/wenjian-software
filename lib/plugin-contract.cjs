const API_VERSION=1,MAX_PACKAGE_BYTES=262144;
const permissions=['external.open','selection.read','clipboard.write'];
function externalUrl(value){if(typeof value!=='string'||value.length>2048||/[\x00-\x20]/.test(value))throw Error('工具入口网址无效。');const u=new URL(value);if(u.username||u.password||!(u.protocol==='https:'||(u.protocol==='http:'&&['127.0.0.1','[::1]','localhost'].includes(u.hostname))))throw Error('工具入口应使用 HTTPS 或本机地址。');return u.toString();}
function validatePackage(value,build){
 if(!value||value.format!=='wenjian-plugin'||value.schema!==1||!value.manifest)throw Error('不是有效的问间插件接入包。');
 const m=value.manifest;if(typeof m.id!=='string'||!/^([a-z0-9]+[.-])+[a-z0-9-]+$/.test(m.id)||m.id.length>100)throw Error('插件 ID 应为反向域名或分组名称。');
 for(const [k,max]of [['name',80],['author',100],['description',500]])if(typeof m[k]!=='string'||!m[k].trim()||m[k].length>max)throw Error('插件名称、作者或说明不完整。');
 if(typeof m.version!=='string'||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(m.version)||m.apiVersion!==API_VERSION||m.kind!=='external-tool')throw Error('当前仅支持接口 v1 的外部工具插件。');
 if(!Number.isSafeInteger(m.minAppBuild)||m.minAppBuild<332||m.minAppBuild>build)throw Error('插件需要更新版本的问间，或兼容构建号无效。');
 if(!Array.isArray(m.platforms)||!m.platforms.includes('mac')||m.platforms.some(x=>!['mac','windows','android','web'].includes(x)))throw Error('插件未声明兼容 Mac。');
 if(!Array.isArray(m.permissions)||m.permissions.some(p=>!permissions.includes(p))||new Set(m.permissions).size!==m.permissions.length||!m.permissions.includes('external.open'))throw Error('插件申请了当前不支持的权限。');
 if(!m.launch||!['open','copy-selection-and-open'].includes(m.launch.mode))throw Error('外部工具启动方式无效。');
 if(m.launch.mode==='copy-selection-and-open'&&!['selection.read','clipboard.write'].every(p=>m.permissions.includes(p)))throw Error('复制选文需要声明选文和剪贴板权限。');
 const url=externalUrl(m.launch.url);if(typeof m.license!=='string'||!m.license.trim()||m.license.length>100)throw Error('请注明插件许可。');
 if(value.code!==undefined||m.entry!==undefined||value.files!==undefined)throw Error('当前接入包不执行脚本或二进制文件。');
 if(value.readme!==undefined&&(typeof value.readme!=='string'||value.readme.length>64000))throw Error('插件使用说明过长。');
 return {format:'wenjian-plugin',schema:1,manifest:{id:m.id,name:m.name.trim(),author:m.author.trim(),description:m.description.trim(),version:m.version,apiVersion:1,minAppBuild:m.minAppBuild,kind:'external-tool',platforms:[...m.platforms],permissions:[...m.permissions],launch:{mode:m.launch.mode,url},license:m.license.trim(),...(m.homepage?{homepage:externalUrl(m.homepage)}:{})},readme:value.readme||''};
}
module.exports={API_VERSION,MAX_PACKAGE_BYTES,validatePackage,externalUrl};
