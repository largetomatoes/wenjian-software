// Exercise actual Electron window close events; supply deterministic native dialog answers.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..'),out=path.join(root,'outputs/windows-close'),label=process.env.WENJIAN_TEST_LABEL||'staged324';
async function run(){
 fs.mkdirSync(out,{recursive:true});const data=path.join(out,label+'-'+process.pid);fs.mkdirSync(data);fs.copyFileSync(path.join(root,'work/mac-app/seed.json'),path.join(data,'notebook.json'));fs.writeFileSync(path.join(data,'tray-config.json'),'{"closeToTray":true}');
 const bootstrap=path.join(out,'bootstrap.cjs');fs.writeFileSync(bootstrap,`Object.defineProperty(process,'resourcesPath',{value:${JSON.stringify(path.join(root,'work/mac-app/windows-resources'))}});require(${JSON.stringify(path.join(root,'work/mac-app/windows-stage/main.js'))});`);
 const app=await _electron.launch({executablePath:process.env.WENJIAN_TEST_EXECUTABLE||require('../work/mac-app/node_modules/electron'),args:process.env.WENJIAN_TEST_EXECUTABLE?[]:[bootstrap],env:{...process.env,WENJIAN_TEST_DATA_DIR:data},timeout:30000}),page=await app.firstWindow(),report={label,checks:[]};let exited=false;
 app.process().once('exit',()=>exited=true);
 async function snapshot(){return app.evaluate(({BrowserWindow})=>({visible:BrowserWindow.getAllWindows()[0]?.isVisible(),destroyed:BrowserWindow.getAllWindows()[0]?.isDestroyed(),options:globalThis.__closeProbe.options}));}
 async function close(){await app.evaluate(({BrowserWindow})=>{globalThis.__closeProbe.options=null;BrowserWindow.getAllWindows()[0].close();});for(let i=0;i<100;i++){const state=await snapshot();if(state.options)return state;await page.waitForTimeout(30);}throw Error('Close prompt did not appear');}
 async function choose(response,checkboxChecked=false){await app.evaluate((_,answer)=>globalThis.__closeProbe.resolve(answer),{response,checkboxChecked});await page.waitForTimeout(100);}
 try{
  await page.getByRole('button',{name:'进入问间',exact:true}).click();await page.waitForFunction(()=>typeof window.__wenjianPrepareClose==='function');
  await app.evaluate(({dialog})=>{globalThis.__closeProbe={};dialog.showMessageBox=async(_win,options)=>{globalThis.__closeProbe.options=options;return new Promise(resolve=>globalThis.__closeProbe.resolve=resolve);};});
  const first=await close();assert(first.visible);assert.deepEqual(first.options.buttons,['退出软件','最小化到托盘','取消']);assert.equal(first.options.checkboxChecked,false);await choose(2);assert((await snapshot()).visible);report.checks.push('First close asks explicitly despite an old close-to-tray preference; cancel keeps the window');
  await close();await choose(1);assert.equal((await snapshot()).visible,false);await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.show();win.focus();});assert((await snapshot()).visible);report.checks.push('Tray choice hides and restores the same live window');
  await page.evaluate(()=>{window.__closeOriginal=window.__wenjianPrepareClose;window.__wenjianPrepareClose=async()=>{throw Error('fixture save failure');};});await close();await choose(0);const blocked=await snapshot();assert.equal(blocked.options.type,'error');assert(blocked.visible);assert(!exited);await choose(0);report.checks.push('Failed save preparation prevents exit and restores the window');
  await page.evaluate(()=>{window.__wenjianPrepareClose=async()=>{window.__preparedBeforeQuit=true;return window.__closeOriginal();};});await close();await app.evaluate(()=>globalThis.__closeProbe.resolve({response:0,checkboxChecked:false}));await page.waitForFunction(()=>window.__preparedBeforeQuit===true);for(let i=0;i<100&&!exited;i++)await new Promise(resolve=>setTimeout(resolve,50));assert(exited,'Exit choice must actually terminate after saves');report.checks.push('Exit choice invokes the real save protocol, then terminates the application');
 }catch(error){report.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(report,null,2));if(!exited)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
 console.log(JSON.stringify(report,null,2));
}
run().catch(error=>{console.error(error);process.exitCode=1;});
