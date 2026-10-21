const fs=require('node:fs'),path=require('node:path');
module.exports=require(fs.existsSync(path.join(__dirname,'plugin-model.cjs'))?'./plugin-model.cjs':'../../../lib/plugin-model.cjs');
