'use strict';
const path=require('node:path'),fs=require('node:fs/promises'),{constants}=require('node:fs');
const translocated=value=>typeof value==='string'&&/(?:^|[\\/])AppTranslocation(?:[\\/]|$)/i.test(value);
function manual(message){const error=Error(message+' 请先保存并退出问间，再通过 Finder 将“问间.app”移到“应用程序”（Applications），从该位置重新打开后更新；也可以下载新版，退出后手动覆盖应用。笔记资料目录无需移动，已下载的更新包会保留。');error.code='MANUAL_INSTALL_REQUIRED';return error;}
async function checkInstallLocation({platform,exePath,io=fs}){
 const target=platform==='darwin'?path.dirname(path.dirname(path.dirname(exePath))):path.dirname(exePath);
 if(platform!=='darwin'){if(path.parse(target).root===target)throw Error('当前应用路径不能原位更新。');await io.access(path.dirname(target),constants.W_OK);return target;}
 // Inspect both the executed path and its physical path. Finder aliases and
 // /var vs /private/var spellings must not bypass the read-only mount check.
 if(translocated(exePath)||translocated(target))throw manual('当前应用运行在 macOS 的临时只读安全隔离位置，无法在此原位更新。');
 if(path.extname(target).toLowerCase()!=='.app')throw manual('当前应用路径不适合原位更新。');
 try{const actual=await io.realpath(target);if(translocated(actual))throw manual('当前应用实际位于 macOS 的临时只读安全隔离位置。');await io.access(target,constants.W_OK);await io.access(path.dirname(target),constants.W_OK);}
 catch(error){if(error.code==='MANUAL_INSTALL_REQUIRED')throw error;if(['EROFS','EACCES','EPERM','ENOENT'].includes(error.code))throw manual('当前安装目录不可写或已移动，问间未开始安装。');throw error;}
 return target;
}
module.exports={checkInstallLocation,translocated};
