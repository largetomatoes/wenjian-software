// Validate the small, durable reading-progress transactions for both desktop systems.
function validReaderProgress(items){
 return Array.isArray(items)&&items.length<=100&&items.every(item=>item&&typeof item.id==='string'&&item.id.length>0&&item.progress&&typeof item.progress==='object'&&!Array.isArray(item.progress)&&Object.entries(item.progress).every(([key,value])=>{
  if(key==='cfi')return typeof value==='string'&&value.length<20000;
  if(key==='rotation')return [0,90,180,270].includes(value);
  if(key==='percentage'||key==='pdfOffset')return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
  if(key==='pdfMode')return value==='single'||value==='continuous';
  return ['page','totalPages','pdfOffsetPage'].includes(key)&&Number.isSafeInteger(value)&&value>0;
 }));
}
module.exports={validReaderProgress};
