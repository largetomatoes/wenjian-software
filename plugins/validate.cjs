const fs=require('node:fs'),crypto=require('node:crypto');
const {validatePackage,MAX_PACKAGE_BYTES}=require('../lib/plugin-contract.cjs');
try {
 const file=process.argv[2];if(!file)throw Error('用法：node plugins/validate.cjs 文件 [构建号=336] [mac|windows|android|web]');
 const build=Number(process.argv[3]||336);if(!Number.isSafeInteger(build)||build<1)throw Error('构建号无效');
 const bytes=fs.readFileSync(file);if(bytes.length>MAX_PACKAGE_BYTES)throw Error('包超过 1 MiB');
 const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,''));
 const platform=process.argv[4]||input.manifest?.platforms?.[0]||'mac';
 const p=validatePackage(input,build,platform);
 if(['android','web'].includes(platform)&&p.manifest.apiVersion!==1)throw Error('手机与 Web App 当前仅支持 v1 外部工具');
 console.log(JSON.stringify({id:p.manifest.id,version:p.manifest.version,apiVersion:p.manifest.apiVersion,build,platform,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')},null,2));
} catch(e){console.error(e.message);process.exitCode=1;}
