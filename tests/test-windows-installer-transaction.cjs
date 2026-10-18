// Exercise the actual installer transaction using a tiny fake payload and redirected test-only OS entries.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
if(process.platform!=='win32'||!process.env.MAKENSIS)throw Error('Windows and MAKENSIS are required');
const root=path.resolve('outputs/installer-transaction-'+process.pid),payload=path.join(root,'payload'),target=path.join(root,'installed'),data=path.join(root,'separate-data');
assert(root.startsWith(path.resolve('.')+path.sep)&&target.startsWith(root+path.sep),'Test installation must remain in the workspace');
fs.mkdirSync(path.join(payload,'resources'),{recursive:true});fs.mkdirSync(data);fs.writeFileSync(path.join(data,'notebook.json'),'fictional notebook must survive');
fs.writeFileSync(path.join(payload,'Wenjian.exe'),'fictional executable v1');fs.writeFileSync(path.join(payload,'resources/app.asar'),'fictional app archive');
const registry='Software\\WenjianInstallerTest\\Run'+process.pid,setup=path.join(root,'setup.exe'),script=path.join(root,'setup.nsi');
let source=fs.readFileSync('work/mac-app/scripts/windows-installer.nsi','utf8');
source=source.replaceAll('Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Wenjian',registry)
 .replaceAll('$SMPROGRAMS\\问间',path.join(root,'test-start-menu')).replaceAll('$DESKTOP\\问间.lnk',path.join(root,'test-desktop.lnk'))
 .replaceAll('..'+String.fromCharCode(92)+'InstallerIcon-win.ico',path.resolve('work/mac-app/InstallerIcon-win.ico'))
 .replaceAll('..'+String.fromCharCode(92)+'AppIcon-win.ico',path.resolve('work/mac-app/AppIcon-win.ico'));
assert(!source.includes('Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Wenjian'));
assert(!source.includes('$SMPROGRAMS')&&!source.includes('$DESKTOP\\问间.lnk'));
fs.writeFileSync(script,source);
const report=[];
function compile(){const result=spawnSync(process.env.MAKENSIS,['-V2','-INPUTCHARSET','UTF8','-DAPP_DIR='+payload,'-DOUT_FILE='+setup,'-DAPP_VERSION=3.14','-DAPP_BUILD=322',script],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stdout+result.stderr);}
function install(){const result=spawnSync(setup,['/S','/D='+target],{windowsHide:true,timeout:20000});assert.equal(result.status,0,'Installation failed: '+result.error);}
async function run(){try{
 compile();install();assert.equal(fs.readFileSync(path.join(target,'Wenjian.exe'),'utf8'),'fictional executable v1');assert(fs.existsSync(path.join(target,'Uninstall.exe')));report.push('Custom directory installation creates program and uninstaller');
 fs.writeFileSync(path.join(payload,'Wenjian.exe'),'fictional executable v2');compile();install();assert.equal(fs.readFileSync(path.join(target,'Wenjian.exe'),'utf8'),'fictional executable v2');assert(!fs.readdirSync(root).some(name=>name.startsWith('installed.previous-')));report.push('Covering installation replaces program and removes its previous staging directory');
 const uninstall=spawnSync(path.join(target,'Uninstall.exe'),['/S'],{windowsHide:true,timeout:20000});assert.equal(uninstall.status,0);
 for(let i=0;i<80&&fs.existsSync(target);i++)await new Promise(resolve=>setTimeout(resolve,100));
 assert(!fs.existsSync(target));assert.equal(fs.readFileSync(path.join(data,'notebook.json'),'utf8'),'fictional notebook must survive');assert(!fs.existsSync(path.join(root,'test-desktop.lnk')));report.push('Uninstall removes only test program files and shortcuts; separate notebook survives');
 fs.writeFileSync(path.join(root,'report.json'),JSON.stringify({checks:report,registryRedirect:registry},null,2));console.log('PASS:',JSON.stringify(report));
}finally{spawnSync('reg.exe',['delete','HKCU\\'+registry,'/f'],{windowsHide:true,stdio:'ignore'});}}
run().catch(error=>{console.error(error);process.exitCode=1;});
