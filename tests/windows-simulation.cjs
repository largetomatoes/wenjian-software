// Exercise Windows application branches on a Mac. This is NOT a Windows driver benchmark.
function bootstrap(resourceDir,main,simulate=false){
 const prefix=`Object.defineProperty(process,'resourcesPath',{value:${JSON.stringify(resourceDir)}});`;
 if(!simulate)return prefix+`require(${JSON.stringify(main)});`;
 return prefix+`const electron=require('electron'),Module=require('node:module'),path=require('node:path'),fs=require('node:fs');Object.defineProperty(process,'platform',{value:'win32'});electron.app.whenReady().then(()=>electron.session.defaultSession.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36'));const file=${JSON.stringify(main)},testModule=new Module(file);testModule.filename=file;testModule.paths=Module._nodeModulePaths(path.dirname(file));testModule._compile(fs.readFileSync(file,'utf8')+${JSON.stringify('\nglobal.__testCheckpoint=checkpointLocalData;')},file);`;
}
module.exports={bootstrap};
