import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/app-updates.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,URL});
const {compareVersions,selectUpdate,versionParts}=module.exports;
assert.equal(compareVersions('3.00','2.4.2'),1);
assert.equal(compareVersions('v3.00','3.0.0'),0);
assert.equal(versionParts('1.02.3'),null,'invalid canonical SemVer remains rejected');
const root='https://github.com/largetomatoes/mac-/releases';
for(const [platform,arch,suffix] of [['android','universal','Android.apk'],['darwin','arm64','macOS-arm64.zip'],['win32','x64','Windows-x64.zip']]){
 const asset=`Wenjian-3.00-${suffix}`,url=`${root}/download/v3.00/${asset}`;
 const release={tag_name:'v3.00',html_url:root+'/tag/v3.00',assets:[{name:asset,browser_download_url:url,state:'uploaded'}]};
 assert.equal(selectUpdate([release],{version:'2.4.2',platform,arch}).download,url);
 assert.equal(selectUpdate([release],{version:'3.00',platform,arch}).state,'current');
 assert.equal(selectUpdate([{...release,assets:[]}],{version:'2.4.2',platform,arch}).state,'missing');
}
console.log('PASS: 3.00 and canonical version comparison, all three platform asset links and missing-package handling');

assert.equal(compareVersions('3.1','3.01'),1);
const sequence=['3.1','3.14','3.141','3.1415','3.14159','3.141592','3.1415926'];
for(let i=1;i<sequence.length;i++){assert.equal(compareVersions(sequence[i],sequence[i-1]),1);assert.equal(module.exports.nextPiVersion(sequence[i-1]),sequence[i]);}
assert.equal(versionParts('3.142'),null);
console.log('PASS: pi-prefix release progression and legacy 3.01 ordering');

for(const [platform,arch,suffix] of [['android','universal','Android.apk'],['darwin','arm64','macOS-arm64.zip'],['win32','x64','Windows-x64.zip']]){
 const asset=`Wenjian-3.14-build319-${suffix}`,url=`${root}/download/v3.14/${asset}`;
 const release={tag_name:'v3.14',html_url:root+'/tag/v3.14',body:'<!-- wenjian-build:319 -->',assets:[{name:asset,browser_download_url:url,state:'uploaded'}]};
 assert.equal(selectUpdate([release],{version:'3.14',build:'317',platform,arch}).state,'available');
 assert.equal(selectUpdate([release],{version:'3.14',build:'317',platform,arch}).download,url);
 assert.equal(selectUpdate([release],{version:'3.14',build:'319',platform,arch}).state,'current');
 assert.equal(selectUpdate([release],{version:'3.14',build:'320',platform,arch}).state,'ahead');
 assert.equal(selectUpdate([{...release,assets:[]}],{version:'3.14',build:'317',platform,arch}).state,'missing');
}
console.log('PASS: same-version build upgrades for Mac, Windows and Android; current/ahead builds and missing artifacts handled');

assert.equal(module.exports.RELEASES_API,'https://api.github.com/repos/largetomatoes/wenjian-software/releases?per_page=30');
assert.equal(module.exports.RELEASES_PAGE,'https://github.com/largetomatoes/wenjian-software/releases');
for(const repo of ['wenjian-software','mac-']){
 const base=`https://github.com/largetomatoes/${repo}/releases`;
 assert(module.exports.validReleaseUrl(base));
 for(const [platform,arch,suffix]of [['darwin','arm64','macOS-arm64.zip'],['win32','x64','Windows-x64.zip'],['android','universal','Android.apk']]){
  const name=`Wenjian-3.14-build320-${suffix}`,url=base+'/download/v3.14/'+name;
  const release={tag_name:'v3.14',html_url:base+'/tag/v3.14',body:'<!-- wenjian-build:320 -->',assets:[{name,browser_download_url:url,state:'uploaded'}]};
  assert.equal(selectUpdate([release],{version:'3.14',build:'319',platform,arch}).download,url);
  assert.equal(selectUpdate([release],{version:'3.14',build:'320',platform,arch}).state,'current');
 }
}
for(const bad of ['https://github.com/largetomatoes/wenjian-software-other/releases','https://github.com/other/wenjian-software/releases','http://github.com/largetomatoes/wenjian-software/releases','https://user:secret@github.com/largetomatoes/wenjian-software/releases','https://github.com:444/largetomatoes/wenjian-software/releases','https://github.com/largetomatoes/wenjian-software/releases/download/v3.14/a%2Fb.zip','https://github.com/largetomatoes/wenjian-software/releases?url=evil'])assert.equal(module.exports.validReleaseUrl(bad),false,bad);
console.log('PASS: renamed and historical repository releases accepted on three platforms, lookalike sources rejected');

const independent={tag_name:'v3.14-build321',html_url:'https://github.com/largetomatoes/wenjian-software/releases/tag/v3.14-build321',body:'<!-- wenjian-build:321 -->',assets:[{name:'Wenjian-3.14-build321-Windows-x64.zip',state:'uploaded',browser_download_url:'https://github.com/largetomatoes/wenjian-software/releases/download/v3.14-build321/Wenjian-3.14-build321-Windows-x64.zip'}]};
const old={...independent,tag_name:'v3.14',body:'<!-- wenjian-build:320 -->'};
assert.equal(selectUpdate([old,independent],{platform:'win32',arch:'x64',version:'3.14',build:'320'}).download,independent.assets[0].browser_download_url);
assert.equal(selectUpdate([independent,old],{platform:'win32',arch:'x64',version:'3.14',build:'321'}).state,'current');
assert.equal(selectUpdate([{...independent,body:'<!-- wenjian-build:322 -->'}],{platform:'win32',arch:'x64',version:'3.14',build:'320'}).state,'empty');
console.log('PASS: independent build Release sorted by build, tag/body mismatch rejected');

const windowsPatch={...independent,tag_name:'v3.14-build322',html_url:independent.html_url.replace('321','322'),body:'<!-- wenjian-build:322 -->\n<!-- wenjian-display-build:321.1 -->\n<!-- wenjian-platforms:win32 -->',assets:independent.assets.map(a=>({...a,name:a.name.replace('321','322'),browser_download_url:a.browser_download_url.replaceAll('321','322')}))};
const upgraded=selectUpdate([windowsPatch,independent],{platform:'win32',arch:'x64',version:'3.14',build:'321'});
assert.equal(upgraded.state,'available');assert.equal(upgraded.build,322);assert.equal(upgraded.displayBuild,'321.1');
assert.equal(selectUpdate([windowsPatch,independent],{platform:'win32',arch:'x64',version:'3.14',build:'322'}).state,'current');
assert.equal(selectUpdate([windowsPatch,independent],{platform:'win32',arch:'x64',version:'3.14',build:'325'}).state,'ahead');
assert.equal(selectUpdate([windowsPatch,independent],{platform:'darwin',arch:'arm64',version:'3.14',build:'321'}).state,'current');
assert.equal(selectUpdate([windowsPatch,independent],{platform:'android',arch:'universal',version:'3.14',build:'321'}).state,'current');
// The shipped 321 discovery logic must still find the Windows update without
// learning the new display-build and platform metadata first.
const legacyModule={exports:{}};
const {execFileSync}=await import('node:child_process');
const legacySource=execFileSync('git',['show','17ec495:lib/app-updates.ts'],{encoding:'utf8'});
vm.runInNewContext(ts.transpileModule(legacySource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:legacyModule,exports:legacyModule.exports,URL});
assert.equal(legacyModule.exports.selectUpdate([windowsPatch,independent],{platform:'win32',arch:'x64',version:'3.14',build:'321'}).download,windowsPatch.assets[0].browser_download_url);
console.log('PASS: integer 322 upgrade from actual 321 parser, display revision 321.1, no downgrade from test 325, platform-specific releases for new clients');

// The public 330 parser must continue to find its own platform when Mac alone is patched.
const legacy330={exports:{}};
vm.runInNewContext(ts.transpileModule(execFileSync('git',['show','ec5f09a:lib/app-updates.ts'],{encoding:'utf8'}),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:legacy330,exports:legacy330.exports,URL});
const releaseRoot='https://github.com/largetomatoes/wenjian-software/releases';
const mac337={tag_name:'v3.141-build337',html_url:releaseRoot+'/tag/v3.141-build337',body:'<!-- wenjian-build:337 -->\n<!-- wenjian-platforms:darwin -->',assets:[{name:'Wenjian-3.141-build337-macOS-arm64.zip',state:'uploaded',browser_download_url:releaseRoot+'/download/v3.141-build337/Wenjian-3.141-build337-macOS-arm64.zip'}]};
const publicReleases=JSON.parse(fs.readFileSync('updates/releases.json','utf8')).releases.filter(r=>module.exports.releaseBuild(r)<=336);
for(const [platform,arch,build]of [['darwin','arm64',337],['win32','x64',336],['android','universal',336]]){const result=legacy330.exports.selectUpdate([mac337,...publicReleases],{platform,arch,version:'3.14',build:'330'});assert.equal(result.state,'available');assert.equal(result.build,build);}
console.log('PASS: actual public 330 finds Mac 337, Windows/Android 336 with platform-specific patches');

const all338={...mac337,tag_name:'v3.141-build338',html_url:releaseRoot+'/tag/v3.141-build338',body:'<!-- wenjian-build:338 -->\n<!-- wenjian-platforms:darwin,win32,android -->',assets:['macOS-arm64.zip','Windows-x64.zip','Android.apk'].map(suffix=>({name:'Wenjian-3.141-build338-'+suffix,state:'uploaded',browser_download_url:releaseRoot+'/download/v3.141-build338/Wenjian-3.141-build338-'+suffix}))};
for(const [platform,arch]of [['darwin','arm64'],['win32','x64'],['android','universal']]){const result=legacy330.exports.selectUpdate([all338,mac337,...publicReleases],{platform,arch,version:'3.141',build:'336'});assert.equal(result.state,'available');assert.equal(result.build,338);}
console.log('PASS: one full 338 release is discoverable on all native platforms');

// Desktop-only 340 must not make Android treat an unavailable package as an update.
const desktop340={tag_name:'v3.141-build340',html_url:releaseRoot+'/tag/v3.141-build340',body:'<!-- wenjian-build:340 -->\n<!-- wenjian-platforms:darwin,win32 -->',assets:['macOS-arm64.zip','Windows-x64.zip'].map(name=>({name:'Wenjian-3.141-build340-'+name,state:'uploaded',browser_download_url:releaseRoot+'/download/v3.141-build340/Wenjian-3.141-build340-'+name}))};
const android339={tag_name:'v3.141-build339',html_url:releaseRoot+'/tag/v3.141-build339',body:'<!-- wenjian-build:339 -->\n<!-- wenjian-platforms:darwin,win32,android -->',assets:[{name:'Wenjian-3.141-build339-Android.apk',state:'uploaded',browser_download_url:releaseRoot+'/download/v3.141-build339/Wenjian-3.141-build339-Android.apk'}]};
for(const [platform,arch] of [['darwin','arm64'],['win32','x64']])assert.equal(selectUpdate([desktop340,android339],{platform,arch,version:'3.141',build:'339'}).release.tag_name,'v3.141-build340');
assert.equal(selectUpdate([desktop340,android339],{platform:'android',arch:'universal',version:'3.141',build:'339'}).state,'current');
console.log('PASS: desktop-only 340 updates Mac and Windows while Android remains on 339');

// 341 is distributed by manual Mac installation only, so old clients cannot
// invoke their unsafe in-place updater for it; 339 stays available on Android.
const manual341={tag_name:'v3.141-build341',html_url:releaseRoot+'/tag/v3.141-build341',body:'<!-- wenjian-build:341 -->\n<!-- wenjian-platforms:manual -->',assets:[{name:'Wenjian-3.141-build341-macOS-arm64-Manual.zip',state:'uploaded',browser_download_url:releaseRoot+'/download/v3.141-build341/Wenjian-3.141-build341-macOS-arm64-Manual.zip'}]};
const guarded339={...android339,body:'<!-- wenjian-build:339 -->\n<!-- wenjian-platforms:win32,android -->'};
assert.equal(selectUpdate([manual341,guarded339],{platform:'darwin',arch:'arm64',version:'3.141',build:'339'}).state,'empty');
assert.equal(selectUpdate([manual341,guarded339],{platform:'android',arch:'universal',version:'3.141',build:'339'}).state,'current');
console.log('PASS: manual Mac 341 is not offered to the older auto-updater; Android stays on 339');

// Windows 339 cannot safely run its old self-updater for this release.
const release342={tag_name:'v3.141-build342',html_url:releaseRoot+'/tag/v3.141-build342',body:'<!-- wenjian-build:342 -->\n<!-- wenjian-platforms:android -->',assets:[{name:'Wenjian-3.141-build342-Android.apk',state:'uploaded',browser_download_url:releaseRoot+'/download/v3.141-build342/Wenjian-3.141-build342-Android.apk'},{name:'Wenjian-3.141-build342-Windows-x64-Manual.zip',state:'uploaded',browser_download_url:releaseRoot+'/download/v3.141-build342/Wenjian-3.141-build342-Windows-x64-Manual.zip'}]};
assert.equal(selectUpdate([release342,guarded339],{platform:'android',arch:'universal',version:'3.141',build:'339'}).build,342);
assert.equal(selectUpdate([release342,guarded339],{platform:'win32',arch:'x64',version:'3.141',build:'339'}).state,'current');
assert.equal(selectUpdate([release342,manual341,guarded339],{platform:'darwin',arch:'arm64',version:'3.141',build:'341'}).state,'empty');
console.log('PASS: Android may update to 342; Windows uses manual installer; Mac stays at 341');
