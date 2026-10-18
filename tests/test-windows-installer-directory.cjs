const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
if(process.platform!=='win32')throw Error('This test requires Windows');
const compiler=process.env.MAKENSIS;if(!compiler)throw Error('Set MAKENSIS to the portable compiler');
const source=fs.readFileSync('work/mac-app/scripts/windows-installer.nsi','utf8');
const validator=source.match(/Function CheckInstallDirectory\r?\n[\s\S]*?FunctionEnd/)[0];
const root=path.resolve('outputs/installer-directory-check');fs.mkdirSync(root,{recursive:true});
const exe=path.join(root,'directory-check.exe'),script=path.join(root,'directory-check.nsi');
fs.writeFileSync(script,`Unicode True\nRequestExecutionLevel user\nSilentInstall silent\nInstallDir "$TEMP\\WenjianDirectoryTest"\n!include "LogicLib.nsh"\n!include "FileFunc.nsh"\nOutFile "${exe}"\n${validator}\nFunction .onInit\nReadEnvStr $INSTDIR WENJIAN_DIRECTORY_TEST\nFunctionEnd\nSection\nCall CheckInstallDirectory\nSetErrorLevel 0\nSectionEnd\n`);
const build=spawnSync(compiler,['-V2','-INPUTCHARSET','UTF8',script],{encoding:'utf8',windowsHide:true});assert.equal(build.status,0,build.stdout+build.stderr);
const report=[];
function check(name,directory,expected){const run=spawnSync(exe,['/S','/D='+directory],{windowsHide:true,timeout:15000,env:{...process.env,WENJIAN_DIRECTORY_TEST:directory}});assert.equal(run.status,expected,name+': '+run.error);report.push({name,exitCode:run.status});}
const empty=path.join(root,'empty-'+process.pid);check('Empty custom directory is accepted',empty,0);
const foreign=path.join(root,'unrelated-'+process.pid);fs.mkdirSync(foreign);fs.writeFileSync(path.join(foreign,'personal.txt'),'must survive');check('Unrelated nonempty directory is rejected',foreign,2);assert.equal(fs.readFileSync(path.join(foreign,'personal.txt'),'utf8'),'must survive');
const existing=path.join(root,'existing-'+process.pid);fs.mkdirSync(path.join(existing,'resources'),{recursive:true});fs.writeFileSync(path.join(existing,'Wenjian.exe'),'fixture');fs.writeFileSync(path.join(existing,'resources/app.asar'),'fixture');check('Existing application directory is accepted',existing,0);
check('Drive root is rejected before any write',path.parse(root).root,2);
assert(source.includes('!insertmacro MUI_PAGE_DIRECTORY'));
fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log('PASS: actual compiled NSIS directory guard',JSON.stringify(report));
