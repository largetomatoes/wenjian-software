'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
async function privateJson(file,value){const bytes=Buffer.from(JSON.stringify(value)),handle=await fs.open(file,'wx',0o600);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}if(!(await fs.readFile(file)).equals(bytes))throw Error('更新前资料保护未能核验，未开始安装。');}
async function protectUpdateData({directory,checkpoint,exportRecords,readNotebook,readDrafts,validate}){
 await checkpoint();
 // A SQLite WAL checkpoint does not refresh notebook.json. Export from the
 // worker first, then safeguard the live snapshot, never an old import file.
 if(exportRecords)await exportRecords();
 const value=await readNotebook();if(!Number.isInteger(value.version)||!validate(value.data))throw Error('资料未能核验，未开始安装。');
 const drafts=await readDrafts();
 const folder=path.join(directory,'safeguard-'+Date.now()+'-'+crypto.randomUUID());await fs.mkdir(folder,{recursive:true,mode:0o700});
 await privateJson(path.join(folder,'notebook.json'),value);await privateJson(path.join(folder,'drafts.json'),drafts);
 return folder;
}
module.exports={protectUpdateData};
