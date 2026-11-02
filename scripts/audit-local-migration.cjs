'use strict';
// Read the real source only to produce a private temporary copy. No contents,
// titles, connection settings or credentials are written to the public report.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {readLegacy,stable}=require('../work/mac-app/asar-src/architecture-store.cjs');
async function main(){const profile=path.join(os.homedir(),'Library/Application Support/问间'),config=JSON.parse(await fs.readFile(path.join(profile,'sync-config.json'),'utf8')),source=path.join(config.dataDirectory,'notebook.json'),draft=path.join(profile,'drafts.json'),temporary=await fs.mkdtemp(path.join(os.tmpdir(),'wenjian-private-migration-'));await fs.chmod(temporary,0o700);let store;
 try{for(const [from,name]of [[source,'notebook.json'],[draft,'drafts.json']])for(const suffix of ['', '.wj-journal','.wj-checkpoint'])await fs.copyFile(from+suffix,path.join(temporary,name+suffix)).catch(e=>{if(e.code!=='ENOENT'||!suffix)throw e;});
 const file=path.join(temporary,'notebook.json'),draftsFile=path.join(temporary,'drafts.json'),before=readLegacy(file),beforeDrafts=readLegacy(draftsFile,'draft'),model=require('../work/mac-app/mac-stage/notebook-model.cjs');
 const {createArchitectureData}=require('../work/mac-app/mac-stage/architecture-data.cjs');store=createArchitectureData(file,draftsFile);
 const current=await store.notebook.call('read');assert.equal(stable(current.data),stable(model.normalize(before.data)));assert.equal(stable(current.sync),stable(before.sync));assert.equal(stable(current.localTrash),stable(before.localTrash));assert.equal(stable(await store.drafts.call('read')),stable(beforeDrafts));
 const countHistory=d=>['notes','cards','readingNotes','bookThoughts','crossThoughts'].reduce((n,key)=>n+(d[key]||[]).reduce((a,r)=>a+(r.revisions||[]).length+(r.anchorRevisions||[]).length,0),0);assert.equal(countHistory(current.data),countHistory(before.data));
 const report={passed:true,sourceOnlyRead:true,migrationMatchesSharedNormalization:true,syncStateUnchanged:true,draftsUnchanged:true,historyCount:countHistory(current.data),counts:Object.fromEntries(['notes','cards','readingNotes','bookThoughts','libraryBooks','libraryHighlights','ocrCache','crossThoughts'].map(k=>[k,current.data[k]?.length||0])),integrity:(await store.notebook.call('metrics')).integrity};await fs.mkdir('outputs/local-install',{recursive:true});await fs.writeFile('outputs/local-install/migration-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{if(store)await store.notebook.close();await fs.rm(temporary,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
