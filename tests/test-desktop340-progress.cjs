const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {validReaderProgress}=require('../work/mac-app/asar-src/reader-progress.cjs');
const {createWindowsData}=require('../work/mac-app/asar-src/windows-data.cjs');
(async()=>{
 const progress={page:10,totalPages:80,pdfMode:'continuous',pdfOffset:.42,pdfOffsetPage:10,rotation:90};
 assert(validReaderProgress([{id:'book',progress}]));
 for(const invalid of [{pdfOffset:-.1},{pdfOffset:1.1},{pdfOffset:NaN},{pdfMode:'invalid'},{pdfOffsetPage:0},{random:1}])assert(!validReaderProgress([{id:'book',progress:invalid}]));
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'wenjian-340-')),file=path.join(root,'notebook.json');let db;
 try{await fs.writeFile(file,JSON.stringify({version:1,data:{notes:[],libraryBooks:[{id:'book',format:'pdf',progress:{page:1}}],ocrCache:[]},sync:{pending:[]},localTrash:[{id:'keep'}]}));
 db=createWindowsData(file);let r=await db.call('progress',{version:1,items:[{id:'book',progress}]});assert.equal(r.version,2);assert.equal(JSON.parse(await fs.readFile(file)).version,1,'progress must not rewrite snapshot before checkpoint');
 assert.deepEqual((await db.call('read')).data.libraryBooks[0].progress,progress);assert.equal((await db.call('progress',{version:1,items:[{id:'book',progress}]})).conflict,true);
 await db.close();db=null;db=createWindowsData(file);const reloaded=await db.call('read');assert.deepEqual(reloaded.data.libraryBooks[0].progress,progress);assert.deepEqual(reloaded.localTrash,[{id:'keep'}]);console.log('PASS desktop continuous progress validation, journal save, stale-version rejection and restart');
 }finally{await db?.close().catch(()=>{});await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
