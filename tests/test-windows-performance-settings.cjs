const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createPerformanceSettings}=require('../work/mac-app/asar-src/windows-performance-settings.cjs');
test('graphics starts off, saves only on device, and applies after a restart',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'wj-gpu-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));let disables=0;const app={disableHardwareAcceleration(){disables++;}};
 let settings=createPerformanceSettings({directory,app});assert.equal(disables,1);assert.equal(settings.status().active,false);
 assert.equal(settings.save(true).restartRequired,true);assert.equal(settings.status().active,false);assert.throws(()=>settings.save('true'));
 settings=createPerformanceSettings({directory,app});assert.equal(disables,1);assert.equal(settings.status().active,true);assert.equal(settings.status().restartRequired,false);
 assert.equal(settings.save(false).restartRequired,true);assert.equal(settings.save(true).restartRequired,false);
 fs.writeFileSync(path.join(directory,'windows-performance.json'),'{broken');settings=createPerformanceSettings({directory,app});assert.equal(disables,2);assert(settings.status().warning);settings.save(false);assert.equal(settings.status().warning,'');
 assert.deepEqual(fs.readdirSync(directory),['windows-performance.json']);
});
