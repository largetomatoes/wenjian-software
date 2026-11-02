import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import * as asar from '@electron/asar';
const require=createRequire(import.meta.url);
const dependency=createRequire(require.resolve('@electron/packager'));
const {NtExecutable,NtExecutableResource}=await import(dependency.resolve('resedit'));
async function inspect(directory){
 const file=path.join(directory,'Wenjian.exe'),exe=NtExecutable.from(await fs.readFile(file)),resources=NtExecutableResource.from(exe);
 const entries=resources.entries.filter(e=>e.type==='INTEGRITY'&&e.id==='ELECTRONASAR');
 if(entries.length!==1)throw Error('Windows executable must contain one Electron ASAR integrity resource');
 const list=JSON.parse(Buffer.from(entries[0].bin).toString('utf8'));
 const record=list.find(e=>String(e.file).replace(/[\\/]+/g,'/').toLowerCase()==='resources/app.asar');
 if(!record||record.alg!=='SHA256')throw Error('Windows ASAR integrity identity mismatch');
 const hash=crypto.createHash('sha256').update(asar.getRawHeader(path.join(directory,'resources/app.asar')).headerString).digest('hex');
 return {file,exe,resources,entry:entries[0],list,record,hash};
}
export async function verifyWindowsAsarIntegrity(directory){const value=await inspect(directory);if(value.record.value!==value.hash)throw Error('Windows EXE and app.asar integrity hashes do not match');return value.hash;}
export async function updateWindowsAsarIntegrity(directory){
 const value=await inspect(directory);value.record.value=value.hash;
 value.entry.bin=new TextEncoder().encode(JSON.stringify(value.list)).buffer;
 value.resources.outputResource(value.exe);await fs.writeFile(value.file,Buffer.from(value.exe.generate()));
 return verifyWindowsAsarIntegrity(directory);
}
