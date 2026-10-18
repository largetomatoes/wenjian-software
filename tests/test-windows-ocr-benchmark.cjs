// Isolated native Windows benchmark. No personal library, credentials or network OCR.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs/windows-ocr'),resources=path.join(root,'work/mac-app/windows-resources');
async function run(){
 fs.mkdirSync(out,{recursive:true});const data=path.join(out,'data-'+process.pid);fs.mkdirSync(data,{recursive:true});fs.copyFileSync(path.join(root,'work/mac-app/seed.json'),path.join(data,'notebook.json'));
 const staticRoot=path.join(resources,'static');fs.copyFileSync(path.join(root,'node_modules/tesseract.js/dist/tesseract.esm.min.js'),path.join(staticRoot,'ocr-probe.mjs'));
 fs.writeFileSync(path.join(staticRoot,'ocr-probe.html'),'<!doctype html><html><meta charset="utf-8"><body>OCR benchmark</body></html>');
 const compact=path.join(staticRoot,'reader/ocr-compact');fs.mkdirSync(compact,{recursive:true});for(const lang of ['chi_sim','eng']){fs.copyFileSync(path.join(root,'node_modules/@tesseract.js-data',lang,'4.0.0_best_int',lang+'.traineddata.gz'),path.join(compact,lang+'.traineddata.gz'));fs.copyFileSync(path.join(root,'node_modules/@tesseract.js-data',lang,'4.0.0',lang+'.traineddata.gz'),path.join(staticRoot,'reader/ocr',lang+'.traineddata.gz'));}
 const bootstrap=path.join(out,'bootstrap.cjs');fs.writeFileSync(bootstrap,`Object.defineProperty(process,'resourcesPath',{value:${JSON.stringify(resources)}});require(${JSON.stringify(path.join(root,'work/mac-app/windows-stage/main.js'))});`);
 const app=await _electron.launch({executablePath:require('../work/mac-app/node_modules/electron'),args:[bootstrap],env:{...process.env,WENJIAN_TEST_DATA_DIR:data},timeout:30000});
 const page=await app.firstWindow(),report={platform:process.platform,models:[],memory:[]};let sampling=false,phase='idle';page.on('pageerror',error=>console.log('PAGE ERROR',error.message));
 const timer=setInterval(async()=>{if(sampling)return;sampling=true;try{report.memory.push({time:Date.now(),phase,...await app.evaluate(({app})=>{const m=app.getAppMetrics();return {workingSetMB:m.reduce((s,p)=>s+p.memory.workingSetSize/1024,0),cpuPercent:m.reduce((s,p)=>s+p.cpu.percentCPUUsage,0)};})});}catch{}finally{sampling=false;}},300);
 try{
  await page.waitForURL('http://127.0.0.1:*/**');console.log('app URL',page.url());await page.waitForTimeout(500);
  for(const [model,dpi] of [['full',300],['compact',300],['compact',240]]){
   phase=model+'-'+dpi;const result=await page.evaluate(async({model,dpi})=>{
    const {createWorker}=(await import('/ocr-probe.mjs')).default,marks={},start=performance.now(),mark=name=>marks[name]=performance.now()-start;
    const canvas=document.createElement('canvas');canvas.width=Math.round(595*dpi/72);canvas.height=Math.round(842*dpi/72);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(dpi/72,dpi/72);ctx.fillStyle='#222';ctx.font='14px "Microsoft YaHei"';
    const chinese='阅读让我们把经验与问题联系起来。记录自己的思考，保留原文与不同的观点。';const english='Reading connects ideas. Windows OCR performance test 2026.';
    const expected=[];for(let i=0;i<17;i++){const text=i%3===2?english:chinese;ctx.fillText(text,40,65+i*40);expected.push(text);}mark('renderMs');
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);for(let i=0;i<pixels.data.length;i+=4){const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2],v=Math.min(r,g,b)>100?Math.max(r,g,b):Math.round(.299*r+.587*g+.114*b);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;}ctx.putImageData(pixels,0,0);mark('preprocessedMs');
    const worker=await createWorker('chi_sim+eng',1,{workerPath:'/reader/ocr/worker.min.js',corePath:'/reader/ocr',langPath:model==='compact'?'/reader/ocr-compact':'/reader/ocr',cachePath:'benchmark-'+model,gzip:true});mark('initializedMs');
    await worker.setParameters({user_defined_dpi:String(dpi),preserve_interword_spaces:'1'});const result=await worker.recognize(canvas,{},{text:true,blocks:true});mark('recognizedMs');
    const text=result.data.text,confidence=result.data.confidence;canvas.width=canvas.height=1;await worker.terminate();return {model,dpi,width:Math.round(595*dpi/72),height:Math.round(842*dpi/72),marks,text,expected:expected.join('\n'),confidence};
   },{model,dpi});report.models.push(result);console.log(JSON.stringify({...result,text:result.text.slice(0,110),expected:undefined}));phase='released';await page.waitForTimeout(1500);
  }
  for(const result of report.models){assert(result.text.includes('Reading'));assert(result.text.includes('阅读'));assert(result.confidence>65);}
 }catch(error){report.failure=error.stack;console.log('BENCHMARK ERROR',error);throw error;}finally{clearInterval(timer);fs.writeFileSync(path.join(out,'benchmark.json'),JSON.stringify(report,null,2));await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
