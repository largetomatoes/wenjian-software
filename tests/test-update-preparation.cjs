const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('lib/update-preparation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function load(prepare){const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,window:{__wenjianPrepareClose:prepare},Error});return module.exports.prepareNativeUpdate;}
test('installation waits for drafts and sync safety checks',async()=>{let done=false,finish;const prepare=load(()=>new Promise(resolve=>finish=resolve));const task=prepare().then(()=>done=true);await Promise.resolve();assert.equal(done,false);finish(true);await task;assert.equal(done,true);});
test('failed or rejected draft preparation stops installation',async()=>{await assert.rejects(load(async()=>false)(),/草稿尚未保存/);await assert.rejects(load(async()=>{throw Error('保存失败')})(),/保存失败/);await load(undefined)();});
