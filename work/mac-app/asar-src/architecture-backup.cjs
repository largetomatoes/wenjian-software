'use strict';
const {restoreCompleteBackup}=require('./complete-backup');
async function restoreArchitectureBackup(adapter,options){
 // The portable helper stages and validates the books first. Its draft callback
 // must not modify SQLite: the final callback commits notebook AND drafts in
 // one transaction. A failure therefore leaves both previous versions intact.
 await adapter.call('export');let stagedDrafts;
 const result=await restoreCompleteBackup({...options,writeDrafts:async drafts=>{stagedDrafts=drafts;},writeNotebook:async envelope=>adapter.call('restore-envelope',{envelope,drafts:stagedDrafts??await adapter.call('draft-read')})});
 await adapter.call('export');return result;
}
module.exports={restoreArchitectureBackup};
