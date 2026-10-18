// Reading and background sync may ask for the same missing book simultaneously.
// Share the verified download, including its failure, then allow a later retry.
function createBookDownloads(){
 const pending=new Map();
 return {run(key,download){if(pending.has(key))return pending.get(key);const job=Promise.resolve().then(download).finally(()=>{if(pending.get(key)===job)pending.delete(key);});pending.set(key,job);return job;}};
}
module.exports={createBookDownloads};
