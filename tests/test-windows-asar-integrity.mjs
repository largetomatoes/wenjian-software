import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {createRequire} from 'node:module';import crypto from 'node:crypto';
import * as asar from '../work/mac-app/node_modules/@electron/asar/lib/asar.js';
import {verifyWindowsAsarIntegrity,updateWindowsAsarIntegrity} from '../work/mac-app/scripts/windows-asar-integrity.mjs';
const require=createRequire(import.meta.url),dependency=createRequire(require.resolve('../work/mac-app/node_modules/@electron/packager/dist/resedit.js'));
const {NtExecutable,NtExecutableResource}=await import(dependency.resolve('resedit'));
const resources=async file=>NtExecutableResource.from(NtExecutable.from(await fs.readFile(file))).entries.filter(e=>e.type!=='INTEGRITY').map(e=>({type:e.type,id:e.id,lang:e.lang,hash:crypto.createHash('sha256').update(Buffer.from(e.bin)).digest('hex')}));
test('reused Windows runtime gets matching ASAR integrity without changing icons or metadata',async t=>{
 const runtime=process.env.WENJIAN_WINDOWS_RUNTIME_APP;if(!runtime)return t.skip('Provide the verified Windows runtime path');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wenjian-win-integrity-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));await fs.mkdir(path.join(dir,'resources'));await fs.mkdir(path.join(dir,'stage'));const exe=path.join(dir,'Wenjian.exe');await fs.copyFile(path.join(runtime,'Wenjian.exe'),exe);await fs.writeFile(path.join(dir,'stage/package.json'),'{"main":"main.js"}');await fs.writeFile(path.join(dir,'stage/main.js'),'console.log("new version")');await asar.createPackage(path.join(dir,'stage'),path.join(dir,'resources/app.asar'));
 const before=await resources(exe);await assert.rejects(verifyWindowsAsarIntegrity(dir),/do not match/);await updateWindowsAsarIntegrity(dir);assert.match(await verifyWindowsAsarIntegrity(dir),/^[a-f0-9]{64}$/);assert.deepEqual(await resources(exe),before);
 await fs.writeFile(path.join(dir,'stage/main.js'),'console.log("changed after packaging")');await asar.createPackage(path.join(dir,'stage'),path.join(dir,'resources/app.asar'));await assert.rejects(verifyWindowsAsarIntegrity(dir),/do not match/);
});
