const https=require('node:https');
const fs=require('node:fs/promises');
const path=require('node:path');
const RELEASES_API='https://api.github.com/repos/largetomatoes/wenjian-software/releases?per_page=30';
// Public discovery only. Installation still requires the existing signed manifest.
const RELEASE_MIRRORS=[
 'https://largetomatoes.github.io/wenjian-web/updates/releases.json',
 'https://reader.wenjian-app.workers.dev/updates/releases.json',
];
const roots=['/largetomatoes/wenjian-software/releases','/largetomatoes/mac-/releases'];
function allowedReleaseUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='github.com'&&!url.port&&!url.username&&!url.password&&!url.search&&!url.hash&&roots.some(root=>url.pathname===root||url.pathname.startsWith(root+'/tag/')||url.pathname.startsWith(root+'/download/'))&&!/%2f|%5c/i.test(url.pathname);}catch{return false;}}
function releaseList(value){
 const releases=Array.isArray(value)?value:value?.schema===1?value.releases:null;
 if(!Array.isArray(releases)||releases.length>60)throw Error('更新清单格式不正确');
 for(const r of releases){
  if(!r||typeof r.tag_name!=='string'||!allowedReleaseUrl(r.html_url)||!Array.isArray(r.assets))throw Error('更新清单来源不正确');
  if(r.assets.some(a=>!a||typeof a.name!=='string'||!allowedReleaseUrl(a.browser_download_url)))throw Error('安装包来源不正确');
 }
 return releases.filter(r=>!r.draft&&!r.prerelease);
}
function requestReleases(url){return new Promise((resolve,reject)=>{
 let settled=false;const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
 const request=https.get(url,{headers:{'User-Agent':'Wenjian-Update-Check','Accept':'application/json','Cache-Control':'no-cache'}},response=>{
  const status=response.statusCode;
  if(status!==200){
   response.resume();
   const limited=status===429||status===403&&response.headers['x-ratelimit-remaining']==='0';
   const reset=Number(response.headers['x-ratelimit-reset'])*1000,retry=Number(response.headers['retry-after'])*1000;
   const retryAt=Number.isFinite(reset)&&reset>Date.now()?reset:Number.isFinite(retry)&&retry>0?Date.now()+retry:Date.now()+120000;
   const time=new Date(retryAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
   return finish(Object.assign(Error(limited?`GitHub 更新接口达到访问限额，可在 ${time} 后重试。`:`更新来源返回 ${status}，请稍后重试。`),{status,retryAt,code:limited?'rate-limit':'http'}));
  }
  let bytes=0;const parts=[];
  response.on('data',chunk=>{bytes+=chunk.length;if(bytes>4*1024*1024){response.destroy();finish(Error('更新清单过大'));return;}parts.push(chunk);});
  response.on('error',()=>finish(Error('读取更新清单时连接中断。')));
  response.on('aborted',()=>finish(Error('读取更新清单时连接中断。')));
  response.on('end',()=>{try{finish(null,releaseList(JSON.parse(Buffer.concat(parts).toString('utf8'))));}catch(error){finish(error);}});
 });
 const timer=setTimeout(()=>{finish(Object.assign(Error('连接更新来源超时，请检查网络后重试。'),{code:'timeout'}));request.destroy();},url===RELEASES_API?8000:5000);
 request.on('error',()=>finish(Error('暂时无法连接更新来源，请检查网络后重试。')));
});}
function createReleaseClient({get=requestReleases,now=Date.now,mirrors=RELEASE_MIRRORS}={}){
 const jobs=new Map();let githubRetryAt=0,githubError;
 async function publicReleases(){
  for(const url of mirrors){try{return releaseList(await get(url));}catch{/* Try the independent source before the rate-limited API. */}}
  if(now()>=githubRetryAt){try{return releaseList(await get(RELEASES_API));}catch(error){githubError=error;if(error.code==='rate-limit')githubRetryAt=error.retryAt||now()+120000;}}
  throw Object.assign(Error('官网与备用更新源暂时无法连接。'+(githubError?.message||'请检查网络后重试。')),{retryAt:now()+120000});
 }
 async function cachedPublicReleases(file,manual=false){
  let old;try{old=JSON.parse(await fs.readFile(file,'utf8'));}catch{}
  let hasSuccess=false;try{if(Array.isArray(old?.releases)&&Number.isFinite(old.at)){releaseList(old.releases);hasSuccess=true;}}catch{old=undefined;}
  // Legacy one-hour errors must not prevent the new sources from being tried.
  if(!manual&&old?.retryAt>now())throw Error(old.error||'更新来源暂时无法连接，请稍后重试。');
  if(!manual&&hasSuccess&&!old.error&&now()>=old.at&&now()-old.at<86400000)return releaseList(old.releases);
  if(jobs.has(file))return jobs.get(file);
  const write=async value=>{const temp=file+'.'+process.pid+'.tmp';try{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(temp,JSON.stringify(value),{mode:0o600});await fs.rename(temp,file);}catch{}finally{await fs.rm(temp,{force:true}).catch(()=>{});}};
  const job=publicReleases().then(async releases=>{await write({at:now(),releases});return releases;}).catch(async error=>{
   // Preserve the last successful list for diagnostics and the next upgrade.
   await write({...hasSuccess?{at:old.at,releases:old.releases}:{},failedAt:now(),error:error.message,retryAt:now()+120000});throw error;
  }).finally(()=>jobs.delete(file));jobs.set(file,job);return job;
 }
 return {publicReleases,cachedPublicReleases};
}
module.exports={allowedReleaseUrl,releaseList,createReleaseClient,RELEASE_MIRRORS,...createReleaseClient()};
